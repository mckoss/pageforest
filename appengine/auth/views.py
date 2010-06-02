import logging
import time
from datetime import datetime

from django.conf import settings
from django.shortcuts import redirect
from django.core.urlresolvers import reverse
from django.template.loader import render_to_string
from django.template import RequestContext
from django.http import \
    HttpResponse, HttpResponseForbidden, HttpResponseRedirect, Http404

from google.appengine.api import mail

from utils.decorators import jsonp, method_required
from utils.shortcuts import render_to_response
from utils import crypto

from auth import SignatureError
from auth.forms import RegistrationForm, SignInForm
from auth.models import User, CHALLENGE_EXPIRATION
from auth.middleware import AccessDenied

from apps.models import App


def send_email_verification(request, user):
    """
    Send email verification to this user.
    """
    www = App.lookup('www')
    expires = int(time.time() + 3 * 24 * 60 * 60)
    verification = crypto.sign(user.get_username(),
                               user.email,
                               expires,
                               www.secret)
    context = RequestContext(request, {'registering_user': user,
                                       'verification': verification})
    message = render_to_string('auth/verify-email.txt', context)
    mail.send_mail(sender=settings.SITE_EMAIL_FROM,
                   to=user.email,
                   subject=settings.SITE_NAME + " account verification",
                   body=message)


@method_required('GET', 'POST')
def email_verification(request, verification=None):
    """
    Check verification code and mark user as verified.

    If a verification code is not given, we show the current verified
    state of the signed-in user.
    """
    error = None
    if verification:
        try:
            user = User.verify_email(verification, request.app.secret)
        except SignatureError, exception:
            error = exception.message
        if user and user.email_verified is None:
            user.email_verified = datetime.now()
            user.put()
    else:
        if (request.method == 'POST'
            and 'resend' in request.POST and request.user):
            send_email_verification(request, request.user)
            return HttpResponse('{"resent": true}',
                                mimetype=settings.JSON_MIMETYPE)
        # Show verification status for the currently sign-in in user.
        user = request.user
        if user is None:
            error = "You are not signed in."

    return render_to_response(request, 'auth/email-verification.html',
                              {'verification_user': user,
                               'is_verified': user and user.email_verified,
                               'error': error})


@method_required('GET', 'POST')
def register(request):
    """
    Create a user account on PageForest.
    """
    form = RegistrationForm(request.POST or None)
    # Return HTML form for GET requests.
    if request.method == 'GET':
        if request.user:
            # The user is already signed in.
            return redirect(reverse(sign_in))
        return render_to_response(request, 'auth/register.html',
                                  {'form': form})
    # Return form errors as JSON.
    if not form.is_valid():
        return HttpResponse(form.errors_json(),
                            mimetype=settings.JSON_MIMETYPE)
    # Return empty errors object for validate.
    if 'validate' in request.POST:
        return HttpResponse('{}', mimetype=settings.JSON_MIMETYPE)
    # Create a new user, generate a session key, return success.
    assert request.method == 'POST'
    user = form.save()
    send_email_verification(request, user)
    response = HttpResponse('{"status": 200, "statusText": "Registered"}',
                            mimetype=settings.JSON_MIMETYPE)
    response.set_cookie(settings.SESSION_COOKIE_NAME,
                        user.generate_session_key(request.app),
                        max_age=settings.SESSION_COOKIE_AGE)
    return response


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
            assert request.app.is_www(), \
                "Sign-in should only be enabled on the www domain."
            session_key = user.generate_session_key(request.app)
            response.set_cookie(settings.SESSION_COOKIE_NAME,
                                session_key,
                                max_age=settings.SESSION_COOKIE_AGE)
            # If we've authorized the cross-app, set the
            if app and 'app_auth' in form.cleaned_data and \
                    form.cleaned_data['app_auth']:
                # Cookie names cannot contain unicode!
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
@method_required('GET')
def get_username(request):
    """
    Get the username that is currently signed in.
    """
    if request.user is None:
        raise Http404("The user is not signed in.")
    return HttpResponse(request.user.username, mimetype='text/plain')


@jsonp
@method_required('GET')
def set_session_cookie(request, session_key):
    """
    When a valid session key for the current application is passed on
    the URL, set the cookie for the session key.
    """
    response = HttpResponse(session_key, content_type='text/plain')
    if session_key == 'expired':
        logging.info("Deleting session cookie")
        response.delete_cookie(settings.SESSION_USER_NAME,
                               path=settings.SESSION_COOKIE_PATH)
        response.delete_cookie(settings.SESSION_COOKIE_NAME,
                               path=settings.SESSION_COOKIE_PATH)
    else:
        try:
            user = User.verify_session_key(session_key, request.app)
        except SignatureError, error:
            return AccessDenied(request,
                                "Invalid session key: %s" % unicode(error))
        response.set_cookie(settings.SESSION_USER_NAME, user.get_username(),
                            path=settings.SESSION_COOKIE_PATH,
                            max_age=settings.SESSION_COOKIE_AGE)
        response.set_cookie(settings.SESSION_COOKIE_NAME, session_key,
                            path=settings.SESSION_COOKIE_PATH,
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
    session_key = user.generate_session_key(
        request.app, subdomain=request.subdomain)
    reauth_cookie = user.generate_session_key(
        request.app, subdomain=request.subdomain,
        seconds=settings.REAUTH_COOKIE_AGE)
    response = HttpResponse(session_key, content_type='text/plain')
    response.set_cookie(settings.REAUTH_COOKIE_NAME, reauth_cookie,
                        max_age=settings.REAUTH_COOKIE_AGE)
    return response
