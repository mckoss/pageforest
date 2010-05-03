from django.conf import settings
from django.utils import simplejson as json
from django.http import \
    Http404, HttpResponse, HttpResponseNotAllowed, HttpResponseNotModified

from auth.decorators import login_required
from utils.decorators import jsonp, run_in_transaction
from utils.http import http_datetime
from utils.mime import guess_mimetype
from utils.shortcuts import get_int

from storage.models import KeyValue


@jsonp
def key_value(request, doc_id, key):
    """
    Dispatch requests to the key-value storage interface.
    """
    if doc_id:
        request.key_name = '/'.join(
            (request.app.app_id(), doc_id.lower(), key))
    else:
        # Static resources for this application.
        request.key_name = '/'.join(
            ('meta', request.app.app_id(), key))
    method = request.GET.get('method', request.method)
    function_name = 'key_value_' + method.lower()
    if function_name not in globals():
        allow = [name[10:].upper() for name in globals()
                 if name.startswith('key_value_')]
        allow.sort()
        return HttpResponseNotAllowed(allow)
    response = globals()[function_name](request)
    return response


def key_value_head(request):
    """
    HTTP HEAD request handler.
    """
    response = key_value_get(request)
    response.content = ''
    return response


def key_value_get(request):
    """
    HTTP GET request handler.
    """
    entity = KeyValue.get_by_key_name(request.key_name)
    if entity is None:
        raise Http404("Could not find entity " + request.key_name)
    etag = '"%s"' % entity.sha1
    if etag == request.META.get('HTTP_IF_NONE_MATCH', ''):
        return HttpResponseNotModified()
    last_modified = http_datetime(entity.modified)
    if last_modified == request.META.get('HTTP_IF_MODIFIED_SINCE', ''):
        return HttpResponseNotModified()
    mimetype = guess_mimetype(request.key_name)
    if mimetype == 'text/plain' and entity.valid_json:
        mimetype = settings.JSON_MIMETYPE
    response = HttpResponse(entity.value, mimetype=mimetype)
    response['Last-Modified'] = last_modified
    response['ETag'] = etag
    return response


@login_required
def key_value_put(request):
    """
    HTTP PUT request handler.
    """
    value = request.GET.get('value', request.raw_post_data)
    if isinstance(value, unicode):
        # Convert from unicode to str for BlobProperty.
        value = value.encode('utf-8')
    entity = KeyValue(
        key_name=request.key_name,
        value=value,
        ip=request.META.get('REMOTE_ADDR', '0.0.0.0'))
    entity.put()
    response = HttpResponse('{"status": 200, "statusText": "Saved"}',
                            mimetype=settings.JSON_MIMETYPE)
    response['Last-Modified'] = http_datetime(entity.modified)
    return response


@login_required
def key_value_delete(request):
    """
    HTTP DELETE request handler.
    """
    entity = KeyValue.get_by_key_name(request.key_name)
    if entity is None:
        raise Http404("Could not find entity " + request.key_name)
    entity.delete()
    return HttpResponse('{"status": 200, "statusText": "Deleted"}',
                        mimetype=settings.JSON_MIMETYPE)


@run_in_transaction
def push_transaction(request, value, max_length):
    """
    Datastore transaction for appending to JSON array.
    """
    entity = KeyValue.get_by_key_name(request.key_name)
    if entity is None:
        entity = KeyValue(key_name=request.key_name, value='[]')
    array = json.loads(entity.value)
    array.append(value)
    array = array[-max_length:]
    entity.value = json.dumps(array)
    entity.put()
    return len(array)


@login_required
def key_value_push(request):
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


def key_value_slice(request):
    """
    SLICE method request handler.
    """
    start = get_int(request.GET, 'start', None)
    end = get_int(request.GET, 'end', None)
    response = key_value_get(request)
    array = json.loads(response.content)
    if end is not None:
        array = array[:end]
    if start is not None:
        array = array[start:]
    response.content = json.dumps(array)
    return response
