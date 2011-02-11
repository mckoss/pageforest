import time
import urllib
import hashlib
import logging
import re

from django.conf import settings
from django.utils import simplejson as json
from django.http import HttpResponse, Http404, \
    HttpResponseBadRequest, HttpResponseNotAllowed, HttpResponseNotModified, \
    HttpResponseServerError

from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.runtime import DeadlineExceededError

from utils.decorators import jsonp, run_in_transaction, method_required, \
    no_cache
from utils.http import http_datetime
from utils.mime import guess_mimetype
from utils.json import ModelEncoder, HttpJSONResponse, datetime_from_iso
from utils.shortcuts import render_to_response, lookup_or_404, \
    get_int, get_bool
from utils.channel import dispatch_subscriptions
from utils.models import prefix_filter

from chunks.models import Chunk
from blobs.models import Blob, MAX_INTERNAL_SIZE
from apps.views import app_json_get

ROOT_METHODS = ('GET', 'HEAD', 'LIST')
MAX_PUSH_ATTEMPTS = 5
MAX_LIST = 1000

ALLOWED_ORDER_PROPS = ('modified', '-modified')


@jsonp
def dispatch(request, doc_id, key):
    """
    Dispatch requests to the blob storage interface.
    """
    # REVIEW: This seems like it should be in App or Doc middleware
    # not in a view function!
    if doc_id:
        request.key_name = '/'.join(
            (request.app.get_app_id(), doc_id.lower(), key))
    else:
        if not key:
            if request.method not in ROOT_METHODS:
                return HttpResponseNotAllowed(ROOT_METHODS)
        # Static resources for this application.
        request.key_name = '/'.join(
            ('apps', request.app.get_app_id(), key))
    if not request.key_name.endswith('/'):
        # Force a trailing slash to allow pre-order traversal on key
        # names, and to prevent separate documents on /foo and /foo/
        request.key_name += '/'

    function_name = 'blob_' + request.method.lower()
    if function_name not in globals():
        allow = [name[5:].upper() for name in globals()
                 if name.startswith('blob_')]
        allow.sort()
        logging.info("HttpResponseNotAllowed(%r)" % allow)
        return HttpResponseNotAllowed(allow)
    view_function = globals()[function_name]
    response = view_function(request)
    return response


def blob_head(request):
    """
    HTTP HEAD request handler.
    """
    response = blob_get(request)
    response.content = ''
    return response


def wait_for_update(request, blob):
    """
    Wait for blob update, if wait option specified in query string.
    Otherwise, return 304 Not Modified.
    """
    wait = request.GET.get('wait', '')
    if not wait.isdigit():
        return blob
    start = time.time()
    deadline = start + int(wait)
    original_sha1 = blob.sha1
    try:
        while time.time() < deadline:
            # Sleep one or two seconds.
            elapsed = time.time() - start
            time.sleep(1 if elapsed < 7 else 2)
            # Try to read updated blob from memcache.
            logging.info("Checking memcache for blob update after %.1fs",
                         elapsed)
            blob = Blob.cache_get_by_key_name(request.key_name)
            # Detect changes.
            if blob is None or blob.sha1 != original_sha1:
                break
    except DeadlineExceededError:
        logging.info("Caught DeadlineExceededError after %.1fs" %
                     time.time() - start)
    return blob


@no_cache
def blob_get(request):
    """
    HTTP GET request handler.
    """
    original_key_name = request.key_name
    blob = Blob.get_by_key_name(request.key_name)
    if blob is None and request.key_name.startswith('apps/'):
        request.key_name += 'index.html/'
        blob = Blob.get_by_key_name(request.key_name)
    if blob is None:
        raise Http404("Blob not found: " + original_key_name)
    etag = blob.get_etag()
    # The browser controls sendind HTTP_IF_MODIFIED_SINCE - so we can't
    # rely on that since two writes can be made in a 1 second interval.
    if (etag == request.META.get('HTTP_IF_NONE_MATCH', '')):
        blob = wait_for_update(request, blob)
        if blob is None:
            raise Http404("Blob was deleted: " + request.key_name)
        etag = blob.get_etag()
    mimetype = guess_mimetype(request.key_name.rstrip('/'), blob.value)
    if mimetype == 'text/plain' and blob.valid_json:
        mimetype = settings.JSON_MIMETYPE
    if mimetype.startswith('text') or \
            mimetype == settings.JSON_MIMETYPE:
        mimetype += '; charset=utf-8'
    if not hasattr(request, 'no_cache') and \
        etag == request.META.get('HTTP_IF_NONE_MATCH', ''):
        response = HttpResponseNotModified(mimetype=mimetype)
    else:
        response = HttpResponse(blob.value, mimetype=mimetype)
    response['Last-Modified'] = http_datetime(blob.modified)
    response['X-Last-Modified-ISO'] = blob.modified.isoformat() + 'Z'
    response['ETag'] = etag
    return response


@no_cache
def blob_list(request):
    """
    List children of the selected blob, including size, modification
    timestamp, valid JSON flag and SHA-1 hash.

    The depth option sets a limit on recursive subdirectories. The
    default is 1, which means only direct children, and is optimized
    using the directory index. Setting depth=2 returns children and
    grandchildren, depth=n returns all subchildren up to level n,
    depth=0 means unlimited.

    Example:
    http://scratch.pageforest.com/?method=list&depth=2 returns
    index.html (depth 1)
    images/gradient.jpg (depth 2)
    but not style/css/main.css (depth 3)

    REVIEW: For large numbers of files, only depth=0 and depth=1
    make and sense.  But we also need paging mechanism.
    """
    try:
        keys_only = get_bool(request.GET, 'keysonly', default=False)
        limit = get_int(request.GET, 'limit', default=MAX_LIST)
        limit = min(limit, MAX_LIST)
        depth = get_int(request.GET, 'depth', default=1)
    except ValueError, error:
        return HttpJSONResponse({'statusText': error.message}, status=400)

    query = Blob.all(keys_only=keys_only)

    # REVIEW: This doesn't seem to be working for multiple tag params.
    for tag in request.GET.getlist('tag'):
        query.filter('tags', urllib.unquote_plus(tag))
    if 'prefix' in request.GET:
        depth = 0

    has_order = False
    if depth == 1:
        query.filter('directory', request.key_name)
        if 'since' in request.GET:
            dt = datetime_from_iso(request.GET['since'])
            if dt is None:
                return HttpJSONResponse({'statusText': "Date ('%s') not in ISO-8601 format." %
                                         request.GET['since']},
                                        status=400)
            query.filter('modified >', dt)
        if 'order' in request.GET:
            order_prop = request.GET['order']
            if order_prop not in ALLOWED_ORDER_PROPS:
                return HttpJSONResponse({'statusText': "Invalid order clause: '%s'" % order_prop},
                                        status=400)
            query.order(order_prop)
            has_order = True
    else:
        if 'order' in request.GET or 'since' in request.GET:
            return HttpJSONResponse(
                {'statusText': "Ordering incompatible with deep traversal.  " +
                 "Use depth=1, and no prefix=."},
                status=400)
        if 'prefix' in request.GET:
            prefix_filter(query, 'Blob', request.key_name + request.GET['prefix'])
        else:
            prefix_filter(query, 'Blob', request.key_name, greater='>')

    if 'cursor' in request.GET:
        query.with_cursor(request.GET['cursor'])
    strip_levels = request.key_name.count('/')

    order = []
    blobs = {}
    memcache_mapping = {}
    raw_results = query.fetch(limit)
    for blob in raw_results:
        if keys_only:
            key = blob
        else:
            key = blob.key()
        parts = key.name().split('/')
        parts = parts[strip_levels:-1]
        # TODO: If we add a key_depth field, we can get the store
        # to do the zig-zag query to return just the blobs at a fixed
        # depth with the key prefix.
        if depth != 0 and len(parts) > depth:
            # Ignore blobs that are deeper than maximum depth.
            continue
        rel_key = '/'.join(parts)
        if keys_only:
            blobs[rel_key] = {}
            if has_order:
                order.append(rel_key)
            continue
        item = {
            'size': blob.size,
            'sha1': blob.sha1,
            'json': blob.valid_json,
            'modified': blob.modified,
            }
        if blob.tags:
            item['tags'] = blob.tags
        blobs[rel_key] = item
        if has_order:
            order.append(rel_key)
        # Might as well fill memcache with the small blobs we've read.
        # REVIEW: Would be nice if this were a function in Cachable to
        # preserve information hiding of that mixin.
        if blob._value is None or len(blob._value) <= MAX_INTERNAL_SIZE:
            memcache_mapping[blob.get_cache_key()] = blob.to_protobuf()

    memcache.set_multi(memcache_mapping)

    # Add app.json at the top level of a Pageforest application.
    if (request.key_name == 'apps/' + request.app.get_app_id() + '/'
        and 'app.json'.startswith(request.GET.get('prefix', ''))
        and 'tag' not in request.GET):
        # REVIEW: Not added to the ordered list, if any.
        blobs['app.json'] = {
            'size': request.app.size,
            'sha1': request.app.sha1,
            'json': True,
            'modified': request.app.modified,
            }

    # REVIEW: Should we add an ETag here - and return not modifed
    # if the list is unchanged?
    result = {'items': blobs}
    if has_order:
        result['order'] = order

    # Only return the cursor, if there is some hope of getting additional
    # results.
    if len(raw_results) == limit:
        result['cursor'] = query.cursor()

    return HttpJSONResponse(result, status=None)


@method_required('GET')
def upload_form(request, admin=False):
    """
    Show an HTML form for blob uploads from the browser.
    """
    return render_to_response(request, 'blobs/upload.html', {
            'action': request.GET.get('action', ''),
            'path': request.GET.get('path', '/'),
            })


def get_request_content(request):
    """
    Get the uploaded data for a PUT or PUSH request.
    """
    if 'value' in request.GET:
        return request.GET['value']
    if 'data' in request.FILES:
        return request.FILES['data'].read()
    return request.raw_post_data


def blob_put(request):
    """
    HTTP PUT request handler.

    TODO: Have an if-modified and return 409 Conflict if
    the passed in hash or modified date is incorrect
    """
    value = get_request_content(request)
    if isinstance(value, unicode):
        # Convert from unicode to str for BlobProperty.
        value = value.encode('utf-8')
    transfer_encoding = request.GET.get('transfer-encoding', '')
    if transfer_encoding:
        # Decode base64 if specified in the query string.
        value = value.decode(transfer_encoding)
    # Create a new blob.
    blob = Blob(key_name=request.key_name, value=value)
    # Enable incremental backup for application blobs, e.g. index.html.
    if request.key_name.startswith('apps/'):
        blob.tags.append('pf:backup')
    # Set blob tags from optional query string parameter.
    if 'tags' in request.GET:
        blob.update_tags([urllib.unquote_plus(tag)
                          for tag in request.GET['tags'].split(',')])
    # Save new blob to memcache and datastore.
    blob.put()
    dispatch_subscriptions(blob.key().name(), 'PUT',
                           {'sha1': blob.sha1,
                            'size': blob.size,
                            'modified': blob.modified})
    response = HttpJSONResponse({
            'statusText': "Saved",
            'sha1': blob.sha1})
    response['Last-Modified'] = http_datetime(blob.modified)
    response['X-Last-Modified-ISO'] = blob.modified.isoformat() + 'Z'
    response['ETag'] = blob.get_etag()
    return response


def blob_delete(request):
    """
    HTTP DELETE request handler.

    TODO: Have an If-Match and return 409 Conflict if
    the passed in hash or modified date is incorrect.
    """
    blob = lookup_or_404(Blob, request.key_name)
    blob.delete()
    return HttpJSONResponse({"statusText": "Deleted"})


def json_push(old_value, value, max_length):
    """
    Parse a JSON array, append a new value to it, dump it back to JSON.
    Then create a new Chunk if necessary.
    Return the new length, JSON data, and SHA-1.
    """
    # Push to the JSON array.
    array = json.loads(old_value)
    array.append(value)
    array = array[-max_length:]
    new_length = len(array)
    new_value = json.dumps(array, separators=(',', ':'))
    new_sha1 = hashlib.sha1(new_value).hexdigest()
    # Create a new chunk if necessary.
    if len(new_value) > MAX_INTERNAL_SIZE:
        chunk = Chunk(key_name=new_sha1, value=new_value)
        chunk.put()
    return new_length, new_value, new_sha1


@run_in_transaction
def atomic_update(key_name, old_sha1, new_sha1, new_value):
    """
    Datastore transaction for updating a blob to a new chunk, or new
    internal value of 600 bytes or less. If a new chunk is used, it
    must be created before calling this function.

    This function returns a boolean success flag and the updated blob.
    It fails if the blob was already updated by another process.
    """
    # Read the blob from memcache
    blob = Blob.get_by_key_name(key_name)
    if blob is None:
        blob = Blob(key_name=key_name, valid_json=True)
    elif blob.sha1 != old_sha1:
        # The blob was updated by a different process after we read
        # it. We have to cancel this transaction, create a new chunk
        # from the updated data, then try again.
        return False, blob
    blob.sha1 = new_sha1
    if len(new_value) <= MAX_INTERNAL_SIZE:
        db.Model.__setattr__(blob, 'value', new_value)
    else:
        db.Model.__setattr__(blob, 'value', None)
    blob.put()
    dispatch_subscriptions(blob.key().name(), 'PUSH',
                           {'sha1': blob.sha1,
                            'size': blob.size,
                            'modified': blob.modified})
    # Update was successful, no need to try again.
    return True, blob


def blob_push(request):
    """
    PUSH method request handler.
    """
    max_length = get_int(request.GET, 'max', 100, min=0, max=1000)
    value = get_request_content(request)
    # Attempt to decode JSON.
    try:
        value = json.loads(value)
    except ValueError:
        pass
    # Read the old value of the blob.
    blob = Blob.get_by_key_name(request.key_name)
    # Try to update the blob atomically until it succeeds.
    for attempt in range(MAX_PUSH_ATTEMPTS):
        if blob is None:
            old_value = '[]'
            old_sha1 = None
        else:
            old_value = blob.value
            old_sha1 = blob.sha1
        # Parse JSON array and append to it, create new Chunk if necessary.
        new_length, new_value, new_sha1 = json_push(
            old_value, value, max_length)
        # Update the blob value or point to the new Chunk.
        success, blob = atomic_update(
            request.key_name, old_sha1, new_sha1, new_value)
        if success:
            return HttpJSONResponse({
                    "statusText": "Pushed",
                    "newLength": new_length,
                    "newSha1": new_sha1,
                    })
    else:
        return HttpJSONResponse({
                "statusText":
                    "Failed to update after %d push attempts." %
                MAX_PUSH_ATTEMPTS}, status=503)


slice_etag_re = re.compile(r'^"(.*)\[.*\]"$')


def blob_slice(request):
    """
    SLICE method request handler.
    """
    start = get_int(request.GET, 'start', None)
    end = get_int(request.GET, 'end', None)

    # Modify the etag from '"xxx[start:end]"' to '"xxx"'
    etag_match = slice_etag_re.match(
        request.META.get('HTTP_IF_NONE_MATCH', ''))
    if etag_match:
        request.META['HTTP_IF_NONE_MATCH'] = '"%s"' % etag_match.group(1)

    request.no_cache = True
    response = blob_get(request)

    try:
        array = json.loads(response.content)
        if end is not None:
            array = array[:end]
        if start is not None:
            array = array[start:]
    except:
        return HttpResponseServerError("Blob is not a parsable array.")

    # Modify the results of blob_get to return the slice (and matching ETag)
    response.content = json.dumps(array)

    etag = '"%s[%s:%s]"' % (response['Etag'][1:-1], start or '', end or '')
    if etag == request.META.get('HTTP_IF_NONE_MATCH', ''):
        response = HttpResponseNotModified(mimetype=settings.JSON_MIMETYPE_CS)
    response['ETag'] = etag
    return response
