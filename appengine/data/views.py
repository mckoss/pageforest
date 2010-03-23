from datetime import datetime

from google.appengine.api import memcache

from django.http import Http404, HttpResponse, HttpResponseNotAllowed

from utils.shortcuts import render_to_response
from utils.decorators import jsonp

from data.models import KeyValue

MEMCACHE_TIMEOUT = 24 * 60 * 60  # 24 hours.


def index(request):
    return render_to_response(request, 'data/index.html', locals())


@jsonp
def key_value(request, key_name):
    method = request.GET.get('method', request.method).upper()
    if method == 'GET':
        return key_value_get(request, key_name)
    elif method == 'PUT':
        return key_value_put(request, key_name)
    elif method == 'DELETE':
        return key_value_delete(request, key_name)
    elif method == 'HEAD':
        response = key_value_get(request, key_name)
        response.content = ''
        return response
    else:
        return HttpResponseNotAllowed('GET PUT DELETE HEAD'.split())


def generate_memcache_key(key_name):
    return 'KeyValue:' + key_name


def key_value_get(request, key_name):
    memcache_key = generate_memcache_key(key_name)
    value = memcache.get(memcache_key)
    if value is None:
        entity = KeyValue.get_by_key_name(key_name)
        if entity is None:
            raise Http404
        value = entity.value
        memcache.set(memcache_key, value, MEMCACHE_TIMEOUT)
    return HttpResponse(value, mimetype='text/plain')


def key_value_put(request, key_name):
    value = request.GET.get('value', request.raw_post_data)
    entity = KeyValue(
        key_name=key_name,
        value=value,
        ip=request.META.get('REMOTE_ADDR', '0.0.0.0'),
        timestamp=datetime.now())
    entity.put()
    memcache_key = generate_memcache_key(key_name)
    memcache.set(memcache_key, value, MEMCACHE_TIMEOUT)
    return HttpResponse('saved', mimetype='text/plain')


def key_value_delete(request, key_name):
    entity = KeyValue.get_by_key_name(key_name)
    if entity is None:
        raise Http404
    entity.delete()
    memcache_key = generate_memcache_key(key_name)
    memcache.delete(memcache_key)
    return HttpResponse('deleted', mimetype='text/plain')
