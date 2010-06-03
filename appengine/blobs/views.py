import time
import urllib
import logging

from django.conf import settings
from django.utils import simplejson as json
from django.http import \
    HttpResponse, HttpResponseNotAllowed, HttpResponseNotModified, Http404

from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.runtime import DeadlineExceededError

from auth.decorators import login_required
from utils.decorators import jsonp, run_in_transaction
from utils.http import http_datetime
from utils.mime import guess_mimetype
from utils.json import ModelEncoder
from utils.shortcuts import get_int, lookup_or_404

from blobs.models import Blob

ROOT_METHODS = ('GET', 'HEAD', 'LIST')
INDEX_HTML_METHODS = ('GET', 'HEAD')


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
            if request.method in INDEX_HTML_METHODS:
                key = 'index.html'
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
    blob = lookup_or_404(Blob, request.key_name)
    etag = blob.get_etag()
    last_modified = http_datetime(blob.modified)
    if (last_modified == request.META.get('HTTP_IF_MODIFIED_SINCE', '')
        or etag == request.META.get('HTTP_IF_NONE_MATCH', '')):
        blob = wait_for_update(request, blob)
        if blob is None:
            raise Http404("Blob deleted: " + request.key_name)
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


def blob_list(request):
    """
    List children of the selected blob, including size, modification
    timestamp, valid JSON flag and SHA-1 hash.

    The depth option sets a limit on recursive subdirectories. The
    default is 1, which means only direct children, and is optimized
    using the directory index. Setting depth to 'unlimited' or 0
    returns all children, >1 returns all children up to that depth.

    Example:
    http://scratch.pageforest.com/?method=list&depth=2 returns
    index.html (depth 1)
    images/gradient.jpg (depth 2)
    but not style/css/main.css (depth 3)
    """
    keys_only = bool(request.GET.get('keysonly', ''))
    tag = urllib.unquote_plus(request.GET.get('tag', ''))
    depth = request.GET.get('depth', '1')
    depth = depth.isdigit() and int(depth) or 0
    query = Blob.all(keys_only=keys_only)
    if tag:
        query.filter('tags', tag)
        depth = 0
    elif depth == 1:
        query.filter('directory', request.key_name)
    else:
        query.filter('__key__ >', db.Key.from_path('Blob', request.key_name))
        stop_key_name = request.key_name[:-1] + '0'  # chr(ord('/') + 1)
        query.filter('__key__ <', db.Key.from_path('Blob', stop_key_name))
    strip_levels = request.key_name.count('/')
    result = {}
    # FIXME: This fetches only 100 blobs with one datastore query.
    # With depth=2, deeply nested blobs will be ignored, so we may
    # return only few results even if there are more at depth 1 and 2.
    # To solve this, recursively run a datastore query for each child
    # up to the requested level. However, that may be very expensive.
    # To solve this, introduce a separate model to store the blob
    # meta-info and tree structure, with memcache support.
    memcache_mapping = {}
    memcache_bytes = 0
    for blob in query.fetch(100):
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
            'json': blob.valid_json,
            'modified': blob.modified,
            'sha1': blob.sha1,
            'size': len(blob.value),
            }
        if blob.tags:
            result[filename]['tags'] = blob.tags
        # Save small blobs directly to memcache.
        if len(blob.value) < 20000 and memcache_bytes < 500000:
            protobuf = blob.to_protobuf()
            memcache_mapping[blob.get_cache_key()] = protobuf
            memcache_bytes += len(protobuf)
    # REVIEW: The following line increases memory pressure in
    # memcache. Maybe the expiration time would help?
    memcache.set_multi(memcache_mapping)
    # Generate pretty JSON output.
    serialized = json.dumps(result, sort_keys=True, indent=2,
                            separators=(',', ': '), cls=ModelEncoder)
    return HttpResponse(serialized, mimetype=settings.JSON_MIMETYPE)


@login_required
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
    tags = [urllib.unquote_plus(tag)
            for tag in request.GET.get('tags', '').split(',')]
    blob = Blob(key_name=request.key_name, value=value, tags=tags)
    blob.put()
    response = HttpResponse('{"status": 200, "statusText": "Saved"}',
                            mimetype=settings.JSON_MIMETYPE)
    response['Last-Modified'] = http_datetime(blob.modified)
    response['ETag'] = blob.get_etag()
    return response


@login_required
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


@login_required
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
