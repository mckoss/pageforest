from django.conf import settings
from django.utils import simplejson as json
from django.http import \
    HttpResponse, HttpResponseNotAllowed, HttpResponseNotModified

from google.appengine.ext import db

from auth.decorators import login_required
from utils.decorators import jsonp, run_in_transaction
from utils.http import http_datetime
from utils.mime import guess_mimetype
from utils.json import DateEncoder
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
    response = globals()[function_name](request)
    return response


def blob_head(request):
    """
    HTTP HEAD request handler.
    """
    response = blob_get(request)
    response.content = ''
    return response


def blob_get(request):
    """
    HTTP GET request handler.
    """
    blob = lookup_or_404(Blob, request.key_name)
    etag = blob.get_etag()
    if etag == request.META.get('HTTP_IF_NONE_MATCH', ''):
        return HttpResponseNotModified()
    last_modified = http_datetime(blob.modified)
    if last_modified == request.META.get('HTTP_IF_MODIFIED_SINCE', ''):
        return HttpResponseNotModified()
    mimetype = guess_mimetype(request.key_name.rstrip('/'))
    if mimetype == 'text/plain' and blob.valid_json:
        mimetype = settings.JSON_MIMETYPE
    response = HttpResponse(blob.value, mimetype=mimetype)
    response['Last-Modified'] = last_modified
    response['ETag'] = etag
    return response


def blob_list(request):
    """
    HTTP LIST request handler.
    """
    query = Blob.all()
    query.filter('__key__ >=', db.Key.from_path('Blob', request.key_name))
    stop_key_name = request.key_name[:-1] + '0'  # chr(ord('/') + 1)
    query.filter('__key__ <', db.Key.from_path('Blob', stop_key_name))
    strip_levels = request.key_name.count('/')
    result = {}
    for blob in query.fetch(100):
        parts = blob.key().name().split('/')
        filename = '/'.join(parts[strip_levels:-1])
        result[filename] = {
            'json': blob.valid_json,
            'modified': blob.modified,
            'sha1': blob.sha1,
            'size': len(blob.value),
            }
    serialized = json.dumps(result, sort_keys=True, indent=2,
                            separators=(',', ': '), cls=DateEncoder)
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
    blob = Blob(key_name=request.key_name, value=value)
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
