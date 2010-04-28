import logging
import time
from datetime import datetime, timedelta

from django.conf import settings
from django.shortcuts import redirect
from django.utils import simplejson as json
from django.http import \
    HttpResponse, HttpResponseForbidden, HttpResponseNotFound

from google.appengine.api import memcache, quota
from google.appengine.runtime import DeadlineExceededError

from utils.decorators import jsonp, method_required
from utils.shortcuts import render_to_response
from utils.http import http_datetime
from utils import crypto

from auth.forms import RegistrationForm
from auth.models import User

CHALLENGE_EXPIRATION = 60  # Seconds.


def register(request):
    """Create a user account on PageForest."""
    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('/auth/welcome/')
    else:
        form = RegistrationForm()
    return render_to_response(request, 'auth/register.html', locals())


@method_required('POST')
def validate(request, ajax=None):
    """Interactive registration form validation."""
    form = RegistrationForm(request.POST)
    return HttpResponse(form.errors_json(),
                        mimetype='application/json')


@jsonp
@method_required('GET')
def reauth(request):
    return HttpResponse(json.dumps({
            "__class__": "Error",
            "status": 403,
            "statusText": "Forbidden",
            "message": "No reauth cookie.",
            }), mimetype="application/json")
    return HttpResponse('Reauthenticated', mimetype="text/plain")


@jsonp
@method_required('GET')
def sign_in(request, token):
    return HttpResponse(token, mimetype="text/plain")


@jsonp
@method_required('GET')
def poll(request, token):
    """
    Get the session key for this token, wait up to 30 seconds until it
    becomes available.
    """
    started = time.time()
    seconds = int(request.GET.get('seconds', '30'))
    memcache_key = 'auth.poll~' + token
    try:
        while True:
            if settings.DEBUG:
                logging.info("polling memcache for " + memcache_key)
            session_key = memcache.get(memcache_key)
            if session_key:
                return HttpResponse(session_key, mimetype="text/plain")
            if time.time() > started + seconds:
                break
            time.sleep(3)  # Seconds.
    except DeadlineExceededError:
        pass
    return HttpResponseNotFound(
        'This token is not authenticated yet, please try again.',
        mimetype="text/plain")
