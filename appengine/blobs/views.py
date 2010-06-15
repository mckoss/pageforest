import time
import urllib
import hashlib
import logging

from django.conf import settings
from django.utils import simplejson as json
from django.http import HttpResponse, Http404, \
    HttpResponseBadRequest, HttpResponseNotAllowed, HttpResponseNotModified

from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.runtime import DeadlineExceededError

from utils.decorators import jsonp, run_in_transaction
from utils.http import http_datetime
from utils.mime import guess_mimetype
from utils.json import ModelEncoder
from utils.shortcuts import get_int, get_bool, lookup_or_404

from blobs.models import Blob, MAX_INTERNAL_SIZE
from apps.views import app_json_get

ROOT_METHODS = ('GET', 'HEAD', 'LIST')


@jsonp
def dispatch(request, doc_id, key):
    """
    Dispatch requests to the blob storage interface.
    """
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
            # Sleep two seconds.
            time.sleep(2)
            # Try to read updated blob from memcache.
            logging.info("Checking memcache for blob update after %.1fs" %
                         (time.time() - start))
            blob = Blob.cache_get_by_key_name(request.key_name)
            # Detect changes.
            if blob is None or blob.sha1 != original_sha1:
                break
    except DeadlineExceededError:
        logging.info("Caught DeadlineExceededError after %.1fs" %
                     (time.time() - start))
    return blob


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
    last_modified = http_datetime(blob.modified)
    if (last_modified == request.META.get('HTTP_IF_MODIFIED_SINCE', '')
        or etag == request.META.get('HTTP_IF_NONE_MATCH', '')):
        blob = wait_for_update(request, blob)
        if blob is None:
            raise Http404("Blob was deleted: " + request.key_name)
        etag = blob.get_etag()
        last_modified = http_datetime(blob.modified)
    if (last_modified == request.META.get('HTTP_IF_MODIFIED_SINCE', '')
        or etag == request.META.get('HTTP_IF_NONE_MATCH', '')):
        response = HttpResponseNotModified()
    else:
        mimetype = guess_mimetype(request.key_name.rstrip('/'))
        if mimetype == 'text/plain' and blob.valid_json:
            mimetype = settings.JSON_MIMETYPE
        response = HttpResponse(blob.value, mimetype=mimetype)
    response['Last-Modified'] = last_modified
    response['ETag'] = etag
    return response


def prefix_filter(query, kind, start, stop=None,
                  property_name='__key__', greater='>=', less='<'):
    """
    Add a prefix filter to an existing query object.
    """
    if stop is None:
        # Increase the last character of the start value.
        stop = start[:-1] + chr(ord(start[-1]) + 1)
    query.filter(property_name + ' ' + greater, db.Key.from_path(kind, start))
    query.filter(property_name + ' ' + less, db.Key.from_path(kind, stop))


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
    """
    try:
        keys_only = get_bool(request.GET, 'keysonly', default=False)
        depth = get_int(request.GET, 'depth', default=1)
    except ValueError, error:
        return HttpResponseBadRequest(error.message, 'text/plain')
    query = Blob.all(keys_only=keys_only)
    if 'tag' in request.GET:
        query.filter('tags', urllib.unquote_plus(request.GET['tag']))
        depth = 0
    elif 'prefix' in request.GET:
        prefix_filter(query, 'Blob', request.key_name + request.GET['prefix'])
    elif depth == 1:
        query.filter('directory', request.key_name)
    else:
        prefix_filter(query, 'Blob', request.key_name, greater='>')
    strip_levels = request.key_name.count('/')
    result = {}
    # FIXME: This fetches only 1000 blobs with one datastore query.
    # With depth=2, deeply nested blobs will be ignored, so we may
    # return only few results even if there are more at depth 1 and 2.
    # To solve this, recursively run a datastore query for each child
    # up to the requested level. However, that may be very expensive.
    memcache_mapping = {}
    for blob in query.fetch(1000):
        if keys_only:
            key = blob
        else:
            key = blob.key()
        parts = key.name().split('/')
        parts = parts[strip_levels:-1]
        if depth and len(parts) > depth:
            # Ignore blobs that are deeper than maximum depth.
            continue
        filename = '/'.join(parts)
        if keys_only:
            result[filename] = {}
            continue
        result[filename] = {
            'size': blob.size,
            'sha1': blob.sha1,
            'json': blob.valid_json,
            'modified': blob.modified,
            }
        if blob.tags:
            result[filename]['tags'] = blob.tags
        # Save small blobs directly to memcache.
        if blob._value is None or len(blob._value) <= MAX_INTERNAL_SIZE:
            memcache_mapping[blob.get_cache_key()] = blob.to_protobuf()
    memcache.set_multi(memcache_mapping)
    # Add app.json at the top level of a Pageforest application.
    if request.key_name == 'apps/' + request.app.get_app_id() + '/':
        response = app_json_get(request)
        assert response.status_code == 200
        app_json = response.content
        result['app.json'] = {
            'size': len(app_json),
            'sha1': hashlib.sha1(app_json).hexdigest(),
            'json': True,
            'modified': request.app.modified,
            }
    # Generate pretty JSON output.
    serialized = json.dumps(result, sort_keys=True, indent=2,
                            separators=(',', ': '), cls=ModelEncoder)
    return HttpResponse(serialized, mimetype=settings.JSON_MIMETYPE)


def blob_put(request):
    """
    HTTP PUT request handler.
    """
    value = request.GET.get('value', request.raw_post_data)
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
    response = HttpResponse('{"status": 200, "statusText": "Saved"}',
                            mimetype=settings.JSON_MIMETYPE)
    response['Last-Modified'] = http_datetime(blob.modified)
    response['ETag'] = blob.get_etag()
    return response


def blob_delete(request):
    """
    HTTP DELETE request handler.
    """
    blob = lookup_or_404(Blob, request.key_name)
    blob.delete()
    return HttpResponse('{"status": 200, "statusText": "Deleted"}',
                        mimetype=settings.JSON_MIMETYPE)


@run_in_transaction
def push_transaction(request, value, max_length):
    """
    Datastore transaction for appending to JSON array.
    """
    blob = Blob.get_by_key_name(request.key_name)
    if blob is None:
        blob = Blob(key_name=request.key_name, value='[]')
    array = json.loads(blob.value)
    array.append(value)
    array = array[-max_length:]
    blob.value = json.dumps(array)
    blob.put()
    return len(array)


def blob_push(request):
    """
    PUSH method request handler.
    """
    max_length = get_int(request.GET, 'max', 100, min=0, max=1000)
    try:
        # Attempt to decode JSON.
        value = json.loads(request.raw_post_data)
    except ValueError:
        # Treat it as a simple string.
        value = request.raw_post_data
    length = push_transaction(request, value, max_length)
    return HttpResponse(
        '{"status": 200, "statusText": "Pushed", "newLength": %d}' % length,
        mimetype=settings.JSON_MIMETYPE)


def blob_slice(request):
    """
    SLICE method request handler.
    """
    start = get_int(request.GET, 'start', None)
    end = get_int(request.GET, 'end', None)
    response = blob_get(request)
    array = json.loads(response.content)
    if end is not None:
        array = array[:end]
    if start is not None:
        array = array[start:]
    response.content = json.dumps(array)
    return response
