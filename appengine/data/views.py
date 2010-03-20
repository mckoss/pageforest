from datetime import datetime, timedelta

from django import forms
from django.http import Http404, HttpResponse, HttpResponseNotAllowed

from utils.shortcuts import render_to_response

from auth.models import User
from data.models import KeyValue


class DemoForm(forms.Form):
    key = forms.CharField()
    value = forms.CharField()


def index(request):
    return render_to_response(request, 'data/index.html', locals())


def demo(request):
    demo_form = DemoForm(request.GET or None)
    return render_to_response(request, 'data/demo.html', locals())


def key_value(request, key_name):
    if request.method == 'GET':
        return key_value_get(request, key_name)
    elif request.method == 'PUT':
        return key_value_put(request, key_name)
    elif request.method == 'DELETE':
        return key_value_delete(request, key_name)
    elif request.method == 'HEAD':
        return key_value_get(request, key_name)
    else:
        return HttpResponseNotAllowed('GET PUT DELETE HEAD'.split())


def key_value_get(request, key_name):
    entity = KeyValue.get_by_key_name(key_name)
    if entity is None:
        raise Http404
    return HttpResponse(entity.value, mimetype='text/plain')


def key_value_put(request, key_name):
    entity = KeyValue(
        key_name=key_name,
        value=request.raw_post_data,
        ip=request.META.get('REMOTE_ADDR', '0.0.0.0'),
        timestamp=datetime.now())
    entity.put()
    return HttpResponse('saved', mimetype='text/plain')


def key_value_delete(request, key_name):
    entity = KeyValue.get_by_key_name(key_name)
    if entity is None:
        raise Http404
    entity.delete()
    return HttpResponse('deleted', mimetype='text/plain')
