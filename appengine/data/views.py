from datetime import datetime, timedelta

from django.shortcuts import render_to_response
from django.template import RequestContext
from django.http import HttpResponse, Http404

from auth.models import User
from data.models import KeyValue

CACHE_TIMEOUT = 5 * 60  # Five minutes.


def index(request):
    return render_to_response('data/index.html', locals(),
                              context_instance=RequestContext(request))


def key_value(request, key_name):
    entity = KeyValue.get_by_key_name(key_name)
    if request.method == 'GET':
        if entity is None:
            raise Http404
        mimetype = 'application/javascript'
        response = HttpResponse(entity.value, mimetype=mimetype)
        expires = time.time() + CACHE_TIMEOUT
        response['Expires'] = email.utils.formatdate(expires)[:26] + 'GMT'
        return response
    if request.method == 'PUT':
        if entity is None:
            entity = KeyValue(
                key_name=key_name,
                value=request.raw_post_data,
                creator_ip=request.META.get('REMOTE_ADDR', '0.0.0.0'))
