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

from auth.forms import RegistrationForm, SignInForm
from auth.models import User

CHALLENGE_EXPIRATION = 60  # Seconds.


@method_required('GET', 'POST')
def register(request):
    """
    Create a user account on PageForest.
    """
    form = RegistrationForm(request.POST or None)
    if request.method == 'POST':
        if 'validate' in request.POST:
            return HttpResponse(form.errors_json(),
                                mimetype='application/json')
        if form.is_valid():
            form.save(request)
            return redirect('/welcome/')
    return render_to_response(request, 'auth/register.html', {'form': form})


@method_required('GET', 'POST')
def sign_in(request):
    """
    Check credentials and generate a session key.
    """
    form = SignInForm(request.POST or None)
    if request.method == 'POST':
        if form.is_valid():
            return redirect('/')
    logging.info("errors: %r" % form.errors)
    return render_to_response(request, 'auth/sign-in.html', {'form': form})


@method_required('GET')
def sign_out(request, token):
    """
    Expire the session key cookie.
    """
    response = redirect('/')
    expires = http_datetime(datetime.now() - timedelta(days=1))
    response['Set-Cookie'] = '%s=; expires=%s; path=/' % (
        settings.SESSION_COOKIE_NAME, expires)
    return response


@jsonp
@method_required('GET')
def challenge(request):
    """
    Generate a random signed challenge for login.
    """
    random_key = crypto.random64url(32)
    expires = datetime.now() + timedelta(seconds=CHALLENGE_EXPIRATION)
    challenge = crypto.sign(random_key, expires, request.app.secret)
    ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
    memcache.set(challenge, ip, CHALLENGE_EXPIRATION)
    return HttpResponse(challenge, mimetype='text/plain')


@jsonp
@method_required('GET')
def verify(request, signature):
    """
    Check the challenge signature with the shared user secret.
    If successful, return a session key and re-auth cookie.
    """
    parts = signature.split(crypto.SEPARATOR)
    # Check that the request data contains five parts.
    if len(parts) != 5:
        return HttpResponseForbidden("Authentication must have five parts.",
                                     content_type='text/plain')
    # Check that the expiration time is in the future.
    expires = datetime.strptime(parts[2], "%Y-%m-%dT%H:%M:%SZ")
    if expires < datetime.now():
        return HttpResponseForbidden("The challenge is expired.",
                                     content_type='text/plain')
    # Check that the challenge is unused and was generated recently.
    challenge = crypto.join(parts[1:4])
    challenge_ip = memcache.get(challenge)
    if challenge_ip is None:
        return HttpResponseForbidden("The challenge is unknown.",
                                     content_type='text/plain')
    memcache.delete(challenge)
    # Check that the IP address matches.
    request_ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
    if request_ip != challenge_ip:
        return HttpResponseForbidden(
            "The challenge was issued to a different IP.",
            content_type='text/plain')
    # Check that the username exists.
    username = parts[0]
    user = User.get_by_key_name(username.lower())
    if user is None:
        return HttpResponseForbidden(
            "The username '%s' is unknown." % username,
            content_type='text/plain')
    # Check the password signature.
    signed = crypto.sign(challenge, user.password)
    joined = crypto.join(username, signed)
    if signature != joined:
        return HttpResponseForbidden(
            "The password signature is incorrect.",
            content_type='text/plain')
    # Generate a session key for the next 24 hours.
    key = crypto.join(user.password, request.app.secret)
    expires = datetime.now() + timedelta(seconds=settings.SESSION_COOKIE_AGE)
    session_key = crypto.sign(request.app_id, username, expires, key)
    expires = datetime.now() + timedelta(seconds=settings.REAUTH_COOKIE_AGE)
    reauth_cookie = crypto.sign(request.app_id, username, expires, key)
    response = HttpResponse(session_key, content_type='text/plain')
    response['Set-Cookie'] = '%s=%s; path=/; expires=%s' % (
        settings.REAUTH_COOKIE_NAME, reauth_cookie, http_datetime(expires))
    return response


@jsonp
@method_required('GET')
def reauth(request):
    """
    Attempt to authenticate with a long-lived reauth cookie.
    """
    return HttpResponseForbidden("No reauth cookie.", mimetype="text/plain")
    # return HttpResponse(session_key, mimetype="text/plain")


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
    return HttpResponse(status=204)
