from django.conf import settings
from django.utils import simplejson as json
from django.http import \
    Http404, HttpResponse, HttpResponseNotAllowed, HttpResponseNotModified

from utils.decorators import jsonp, run_in_transaction
from utils.http import http_datetime
from utils.mime import guess_mimetype
from utils.shortcuts import get_int

from data.models import KeyValue

JSON_MIME_TYPE = 'application/json'


def hostname_to_app_id(hostname):
    app_id = hostname.lower()
    for domain in settings.DOMAINS:
        if app_id.endswith('.' + domain):
            return app_id[:-len(domain) - 1]
    return app_id


@jsonp
def key_value(request, entity_name):
    hostname = request.META.get('HTTP_HOST', 'test')
    request.app_id = hostname_to_app_id(hostname)
    if not entity_name:
        entity_name = 'index.html'
    request.key_name = '%s/%s' % (request.app_id, entity_name)
    method = request.GET.get('method', request.method)
    function_name = 'key_value_' + method.lower()
    if function_name not in globals():
        allow = [name[10:].upper() for name in globals()
                 if name.startswith('key_value_')]
        allow.sort()
        return HttpResponseNotAllowed(allow)
    return globals()[function_name](request)


def key_value_head(request):
    response = key_value_get(request)
    response.content = ''
    return response


def key_value_get(request):
    entity = KeyValue.get_by_key_name(request.key_name)
    if entity is None:
        raise Http404
    last_modified = http_datetime(entity.modified)
    if last_modified == request.META.get('HTTP_IF_MODIFIED_SINCE', ''):
        return HttpResponseNotModified()
    mimetype = guess_mimetype(request.key_name)
    response = HttpResponse(entity.value, mimetype=mimetype)
    if last_modified:
        response['Last-Modified'] = last_modified
    return response


def key_value_put(request):
    value = request.GET.get('value', request.raw_post_data)
    if isinstance(value, unicode):
        # Convert from unicode to str for BlobProperty.
        value = value.encode('utf-8')
    entity = KeyValue(
        key_name=request.key_name,
        app_id=request.app_id,
        # TODO: doc_id=request.doc_id,
        value=value,
        ip=request.META.get('REMOTE_ADDR', '0.0.0.0'))
    entity.put()
    response = HttpResponse('{"status": 200, "statusText": "Saved"}\n',
                            mimetype='application/json')
    response['Last-Modified'] = http_datetime(entity.modified)
    return response


def key_value_delete(request):
    entity = KeyValue.get_by_key_name(request.key_name)
    if entity is None:
        raise Http404
    entity.delete()
    return HttpResponse('{"status": 200, "statusText": "Deleted"}\n',
                        mimetype='application/json')


@run_in_transaction
def push_transaction(request, value, max_length):
    entity = KeyValue.get_by_key_name(request.key_name)
    if entity is None:
        entity = KeyValue(key_name=request.key_name, value='[]')
    array = json.loads(entity.value)
    array.append(value)
    array = array[-max_length:]
    entity.value = json.dumps(array)
    entity.put()
    return len(array)


def key_value_push(request):
    max_length = get_int(request.GET, 'max', 100, min=0, max=1000)
    try:  # Attempt to decode JSON.
        value = json.loads(request.raw_post_data)
    except ValueError:  # Treat it as a simple string.
        value = request.raw_post_data
    length = push_transaction(request, value, max_length)
    return HttpResponse(
        '{"status": 200, "statusText": "Pushed", "newLength": %d}\n' % length,
        mimetype=JSON_MIME_TYPE)


def key_value_slice(request):
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
