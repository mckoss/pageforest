from datetime import datetime

from google.appengine.api import memcache

from django.conf import settings
from django.http import Http404, HttpResponse, HttpResponseNotAllowed

from utils.shortcuts import render_to_response
from utils.decorators import jsonp

from data.models import KeyValue


def index(request):
    return render_to_response(request, 'data/index.html', locals())


@jsonp
def key_value(request, entity_name):
    request.app_name = request.META.get('HTTP_HOST', 'test').lower()
    if request.app_name.endswith(settings.HOST_REMOVABLE):
        request.app_name = request.appname[:-len(settings.HOST_REMOVABLE)]
    request.key_name = request.app_name + '/' + entity_name
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
    value = memcache.get(request.key_name)
    if value is None:
        entity = KeyValue.get_by_key_name(request.key_name)
        if entity is None:
            raise Http404
        value = entity.value
        memcache.set(request.key_name, value, settings.MEMCACHE_TIMEOUT)
    return HttpResponse(value, mimetype='text/plain')


def key_value_put(request):
    value = request.GET.get('value', request.raw_post_data)
    entity = KeyValue(
        key_name=request.key_name,
        namespace=request.app_name,
        value=value,
        ip=request.META.get('REMOTE_ADDR', '0.0.0.0'),
        timestamp=datetime.now())
    entity.put()
    memcache.set(request.key_name, value, settings.MEMCACHE_TIMEOUT)
    return HttpResponse('saved', mimetype='text/plain')


def key_value_delete(request):
    memcache.delete(request.key_name)
    entity = KeyValue.get_by_key_name(request.key_name)
    if entity is None:
        raise Http404
    entity.delete()
    return HttpResponse('deleted', mimetype='text/plain')
