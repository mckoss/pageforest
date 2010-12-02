import time
import logging

from django.conf import settings
from django.http import HttpResponse, HttpResponseBadRequest
from django.utils import simplejson as json

from google.appengine.api import memcache

from utils.decorators import jsonp, method_required
from utils.json import ModelEncoder

from auth.decorators import login_required


@jsonp
@method_required('GET')
@login_required
def get_channel(request, extra):
    """
    Return the channel id that the client can use to receive notifications
    from the server.
    """
    channel_data = request.user.get_session_channel(request)

    return HttpResponse(json.dumps(channel_data,
                                   indent=2,
                                   cls=ModelEncoder),
                        mimetype=settings.JSON_MIMETYPE)


@jsonp
@method_required('GET', 'PUT')
@login_required
def subscriptions(request, extra):
    """
    Read or write the subscriptions being monitored by the current
    channel.
    """
    channel_data = request.user.get_session_channel(request)
    if request.method == 'GET':
        return HttpResponse(json.dumps(channel_data['subscriptions'],
                                       indent=2,
                                       cls=ModelEncoder),
                            mimetype=settings.JSON_MIMETYPE)

    assert request.method == 'PUT'

    return HttpResponseBadRequest("NYI")
