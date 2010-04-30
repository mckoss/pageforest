import logging
import time
from datetime import datetime, timedelta

from django.conf import settings
from django.shortcuts import redirect
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
CACHE_PREFIX = 'CR1'


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

    Challenge is S(random/expires/ip, app.secret)
    """
    random_key = crypto.random64url(32)
    expires = int(time.time()) + CHALLENGE_EXPIRATION
    ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
    challenge = crypto.sign(random_key, expires, ip, request.app.secret)
    return HttpResponse(challenge, mimetype='text/plain', status=201)


@jsonp
@method_required('GET')
def verify(request, signature):
    """
    Check the challenge signature with the shared user secret.
    If successful, return a session key and re-auth cookie.

    To protect against replay, we stored any SUCCESSFULLY used
    challenge in memcache until it's expiration time.

    When memcache is not disabled, replays will be allowed
    (but authentic challenges will still be able to succeed).

    Signature is:
        username/S(S(random/expires/ip, app.secret), S(user, pass)) =
        username/random/expires/ip/HMAC-App/HMAC-User
    """
    try:
        parts = signature.split(crypto.SEPARATOR)
        username = parts.pop(0)
        # Check the inner challenge first
        (random, expires, ip) = crypto.verify(parts[:-1], request.app.secret)
        expires = int(expires)
        now = int(time.time())
        if expires < now:
            raise Exception("Challenge expired.")
        if ip != request.META.get('REMOTE_ADDR', '0.0.0.0'):
            raise Exception("IP address changed.")
        user = User.get_by_key_name(username.lower())
        if user is None:
            raise Exception("Unknown user.")
        # Check the user authentication
        crypto.verify(parts, user.password)
        # Ensure this challenge not already used.
        if memcache.get(CACHE_PREFIX + random):
            raise Exception("Already used.")
    except Exception, e:
        return HttpResponseForbidden(
            "Challenge response failed: %s" % e.message,
            content_type='text/plain')

    # Mark the challenge as used until it expires
    memcache.set(CACHE_PREFIX + random, True, time=expires - now)

    # Generate a session key for the next 24 hours.
    key = crypto.join(user.password, request.app.secret)
    # REVIEW: Why an ISO expires instead of epoch seconds?
    expires = datetime.now() + timedelta(seconds=settings.SESSION_COOKIE_AGE)
    session_key = crypto.sign(request.app_id, username, expires, key)
    expires = datetime.now() + timedelta(seconds=settings.REAUTH_COOKIE_AGE)
    reauth_cookie = crypto.sign(request.app_id, username, expires, key)
    response = HttpResponse(session_key, content_type='text/plain', status=201)
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
