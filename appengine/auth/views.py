import logging
import time

from django.conf import settings
from django.shortcuts import redirect
from django.core.urlresolvers import reverse
from django.http import \
    HttpResponse, HttpResponseForbidden, HttpResponseRedirect, Http404

from google.appengine.api import mail, memcache
from google.appengine.runtime import DeadlineExceededError

from django.template.loader import render_to_string
from django.template import RequestContext

from utils.decorators import jsonp, method_required
from utils.shortcuts import render_to_response
from utils import crypto

from auth.forms import RegistrationForm, SignInForm
from auth.models import User, SignatureError, CHALLENGE_EXPIRATION
from auth.middleware import AccessDenied

from apps.models import App


def send_email_verification(request, user):
    """
    Send email to this user.

    TODO: Need to CHECK email token sent to user - and mark account as
    validated.
    """
    message = render_to_string('auth/verify-email.txt',
                               RequestContext(request, {'user': user}))
    mail.send_mail(sender=settings.SITE_EMAIL_FROM,
                   to=user.email,
                   subject=settings.SITE_NAME + " account verification.",
                   body=message)


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
            user = form.save()
            send_email_verification(request, user)
            return redirect(reverse(sign_in))
    return render_to_response(request, 'auth/register.html', {'form': form})


@method_required('GET', 'POST')
def sign_in(request, app_id=None):
    """
    Check credentials and generate session key(s).

    Sign in to:

    - www.pageforest.com
    - app_id.pageforest.com (if given)

    Note: return the application session key to the client via
    ajax, so they can request the cookie on the proper domain.

    This form should only ever be displayed on www.pageforest.com.

    TODO: Generate long-term reauthorization cookies on
    path=/auth/reauth so clients can upate their shorter
    session keys.
    """
    form = SignInForm(request.POST or None)
    app = None
    if app_id:
        app = App.lookup(app_id)
        if app is None or app.is_www():
            return HttpResponseRedirect(reverse(sign_in))

    if app is None:
        del form.fields['app_auth']
    else:
        form.fields['app_auth'].label = app_id.title()

    if request.method == 'POST':
        if form.is_valid():
            user = form.cleaned_data['user']
            kwargs = app_id and {'app_id': app_id} or None
            response = HttpResponseRedirect(reverse(sign_in, kwargs=kwargs))
            # Whenever we sign in - generate a fresh www session key
            assert request.app.get_app_id() == 'www', \
                "Sign-in should only be enabled on the www domain."
            session_key = user.generate_session_key(request.app)
            response.set_cookie(settings.SESSION_COOKIE_NAME,
                                session_key,
                                max_age=settings.SESSION_COOKIE_AGE)
            # If we've authorized the cross-app, set the
            if app and 'app_auth' in form.cleaned_data and \
                    form.cleaned_data['app_auth']:
                # Cookie names cannot unicode!
                app_session_key = user.generate_session_key(app)
                cookie_name = "%s-%s" % (str(app_id),
                                        settings.SESSION_COOKIE_NAME)
                response.set_cookie(cookie_name, app_session_key)
            return response

    app_session_key = None
    if app and request.user:
        app_session_key = request.user.generate_session_key(app)
    return render_to_response(request, 'auth/sign-in.html',
                              {'form': form,
                               'cross_app': app,
                               'session_key': app_session_key})


@jsonp
@method_required('GET', 'POST')
def get_username(request):
    """
    Get the username that is currently signed in.

    REVIEW: Security problem - should require referer is www.pf.com
    """
    if request.user is None:
        raise Http404("The user is not signed in.")
    return HttpResponse(request.user.username, mimetype='text/plain')


@jsonp
@method_required('GET', 'POST')
def set_session_cookie(request, session_key):
    """
    When passed a valid session key for the current application,
    set the cookie for the session key.
    """
    response = HttpResponse(session_key, content_type='text/plain')
    if session_key == 'expired':
        logging.info("Deleting session cookie")
        response.delete_cookie(settings.SESSION_COOKIE_NAME)
    else:
        try:
            user = User.verify_session_key(session_key, request.app)
        except SignatureError, error:
            return AccessDenied(request,
                                "Invalid session key: %s" % unicode(error))
        response.set_cookie(settings.SESSION_COOKIE_NAME, session_key,
                            max_age=settings.SESSION_COOKIE_AGE)
    return response


@method_required('GET')
def sign_out(request, app_id=None):
    """
    Remove the www.pageforest.com session key cookie.

    TODO: De-authorize the application if given.
    """
    kwargs = app_id and {'app_id': app_id} or None
    response = HttpResponseRedirect(reverse(sign_in, kwargs=kwargs))
    response.delete_cookie(settings.SESSION_COOKIE_NAME)
    # Indicate that the sign_in page should clear the application
    # cookie on load.
    if app_id:
        cookie_name = "%s-%s" % (str(app_id),
                                settings.SESSION_COOKIE_NAME)
        response.set_cookie(cookie_name, 'expired')
    return response


@jsonp
@method_required('GET')
def challenge(request):
    """
    Generate a random signed challenge for login.

    Challenge is S(random/expires/ip, app.secret)
    """
    random_key = crypto.random64(32)
    expires = int(time.time() + CHALLENGE_EXPIRATION)
    ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
    challenge_string = crypto.sign(random_key, expires, ip, request.app.secret)
    return HttpResponse(challenge_string, mimetype='text/plain')


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
        username/random/expires/ip/App-Signature/User-Signature
    """
    try:
        user = User.verify_signature(
            signature, request.app, request.META.get('REMOTE_ADDR', '0.0.0.0'))
    except SignatureError, error:
        return HttpResponseForbidden(
            "Invalid signature: " + unicode(error), content_type='text/plain')
    # Return fresh session key and reauth cookie.
    session_key = user.generate_session_key(request.app)
    reauth_cookie = user.generate_session_key(request.app,
            settings.REAUTH_COOKIE_AGE)
    response = HttpResponse(session_key, content_type='text/plain')
    response.set_cookie(settings.REAUTH_COOKIE_NAME, reauth_cookie,
                        max_age=settings.REAUTH_COOKIE_AGE)
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
