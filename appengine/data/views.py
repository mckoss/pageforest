import os
import mimetypes
from datetime import datetime

from google.appengine.api import memcache

from django.conf import settings
from django.http import \
    Http404, HttpResponse, HttpResponseNotAllowed, HttpResponseNotModified

from utils.decorators import jsonp
from utils.http import http_datetime

from data.models import KeyValue

TIMESTAMP_SEPARATOR = '|'


@jsonp
def key_value(request, entity_name):
    request.domain = request.META.get('HTTP_HOST', 'testserver').lower()
    if not entity_name:
        entity_name = 'index.html'
    request.key_name = 'http://%s/%s' % (request.domain, entity_name)
    method = request.GET.get('method', request.method).upper()
    if method == 'GET':
        return key_value_get(request)
    elif method == 'PUT':
        return key_value_put(request)
    elif method == 'DELETE':
        return key_value_delete(request)
    elif method == 'HEAD':
        response = key_value_get(request)
        response.content = ''
        return response
    else:
        return HttpResponseNotAllowed('GET PUT DELETE HEAD'.split())


def key_value_get(request):
    last_modified = None
    value = memcache.get(request.key_name)
    if value is None:
        entity = KeyValue.get_by_key_name(request.key_name)
        if entity is None:
            raise Http404
        last_modified = http_datetime(entity.timestamp)
        value = entity.value
        memcache.set(request.key_name,
                     last_modified + TIMESTAMP_SEPARATOR + value,
                     settings.MEMCACHE_TIMEOUT)
    elif len(value) > 29 and value[29] == TIMESTAMP_SEPARATOR:
        last_modified = value[:29]
        value = value[30:]
    if last_modified == request.META.get('HTTP_IF_MODIFIED_SINCE', ''):
        return HttpResponseNotModified()
    mimetype = guess_mimetype(request.key_name)
    response = HttpResponse(value, mimetype=mimetype)
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
        namespace=request.domain,
        value=value,
        ip=request.META.get('REMOTE_ADDR', '0.0.0.0'),
        timestamp=datetime.now())
    entity.put()
    last_modified = http_datetime(entity.timestamp)
    memcache.set(request.key_name,
                 last_modified + TIMESTAMP_SEPARATOR + value,
                 settings.MEMCACHE_TIMEOUT)
    response = HttpResponse('{"status": 200, "message": "saved"}\n',
                            mimetype='application/json')
    response['Last-Modified'] = last_modified
    return response


def key_value_delete(request):
    memcache.delete(request.key_name)
    entity = KeyValue.get_by_key_name(request.key_name)
    if entity is None:
        raise Http404
    entity.delete()
    return HttpResponse('{"status": 200, "message": "deleted"}\n',
                        mimetype='application/json')


def guess_mimetype(filename):
    name, ext = os.path.splitext(filename.lower())
    if ext in settings.MIMETYPES:
        return settings.MIMETYPES[ext]
    if not mimetypes.inited:
        mimetypes.init()
    if ext in mimetypes.types_map:
        return mimetypes.types_map[ext]
    return 'text/plain'
