from datetime import datetime, timedelta

from django import forms
from django.conf import settings
from django.http import Http404, HttpResponse
from django.http import HttpResponseNotModified, HttpResponseForbidden

from utils.decorators import cache_expires
from utils.shortcuts import render_to_response
from utils.http import HttpResponseCreated

from auth.models import User
from data.models import KeyValue


class DemoForm(forms.Form):
    status = forms.CharField()
    key = forms.CharField()
    value = forms.CharField(widget=forms.Textarea)


def index(request):
    return render_to_response(request, 'data/index.html', locals())


def demo(request):
    demo_form = DemoForm(request.GET or None)
    return render_to_response(request, 'data/demo.html', locals())


def key_value(request, key_name):
    if request.method == 'GET':
        return key_value_get(request, key_name)
    if request.method == 'PUT':
        return key_value_put(request, key_name)
    return HttpResponseForbidden(['GET', 'PUT'])


@cache_expires(settings.CACHE_EXPIRES_SECONDS)
def key_value_get(request, key_name):
    entity = KeyValue.get_by_key_name(key_name)
    if entity is None:
        raise Http404
    return HttpResponse(entity.value, mimetype='text/plain')


def key_value_put(request, key_name):
    entity = KeyValue.get_by_key_name(key_name)
    if entity is None:
        return key_value_create(request, key_name)
    elif request.raw_post_data != entity.value:
        return key_value_update(request, key_name, entity)
    else:
        return HttpResponseNotModified()


def key_value_create(request, key_name):
    now = datetime.now()
    entity = KeyValue(
        key_name=key_name,
        value=request.raw_post_data,
        ip=request.META.get('REMOTE_ADDR', '0.0.0.0'),
        created=now, modified=now)
    entity.put()
    response = HttpResponseCreated(entity.get_absolute_url())
    return response


def key_value_update(request, key_name, entity):
    entity.value = request.raw_post_data
    entity.modified = datetime.now()
    entity.ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
    entity.put()
    return HttpResponse('OK')
