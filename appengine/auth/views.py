import logging
import time
import datetime
import re

from django.conf import settings
from django.shortcuts import redirect
from django.core.urlresolvers import reverse
from django.template.loader import render_to_string
from django.template import RequestContext
from django.http import \
    HttpResponse, HttpResponseForbidden, HttpResponseRedirect, Http404

from google.appengine.api import mail
from google.appengine.ext.db import BadValueError

from utils.decorators import jsonp, method_required
from utils.shortcuts import render_to_response
from utils.forms import ValidationError
from utils import crypto
from utils.json import HttpJSONResponse
from utils.shortcuts import get_int, get_bool

from auth import SignatureError
from auth.forms import SignUpForm, ProfileForm
from auth.models import User, CHALLENGE_EXPIRATION
from auth.middleware import AccessDenied, referer_is_trusted
from auth.decorators import login_required

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
    user = None
    if verification:
        try:
            user = User.verify_email(verification, request.app.secret)
        except SignatureError, exception:
            error = exception.message
        if user and user.email_verified is None:
            user.email_verified = datetime.datetime.now()
            user.put()
    else:
        if (request.method == 'POST'
            and 'resend' in request.POST and request.user):
            send_email_verification(request, request.user)
            return HttpResponse('{"resent": true}',
                                mimetype=settings.JSON_MIMETYPE_CS)
        # Show verification status for the currently sign-in in user.
        user = request.user
        if user is None:
            error = "You are not signed in."

    return render_to_response(request, 'auth/email-verification.html',
                              {'verification_user': user,
                               'is_verified': user and user.email_verified,
                               'error': error})


@method_required('GET', 'POST')
def sign_up(request):
    """
    Create a user account on PageForest.
    """
    form = SignUpForm(request.POST or None)
    # Return HTML form for GET requests.
    if request.method == 'GET':
        if request.user:
            # The user is already signed in.
            return redirect(reverse(sign_in))
        response = render_to_response(request, 'auth/sign-up.html', {
                'form': form})
        return response

    validate = request.POST.get('validate', False)
    # Return form errors as JSON.
    if not form.is_valid():
        return HttpJSONResponse(form.errors_dict(), status=400)
    # Return empty errors object for validate.
    if validate:
        return HttpJSONResponse({})
    # Create a new user, generate a session key, return success.
    assert request.method == 'POST'
    user = form.save()
    send_email_verification(request, user)
    response = HttpJSONResponse({"statusText": "Registered"})
    response.set_cookie(settings.SESSION_COOKIE_NAME,
                        user.generate_session_key(request.app),
                        max_age=settings.SESSION_COOKIE_AGE)
    return response


app_username_match = re.compile(settings.APP_USERNAME_REGEX).match


@method_required('POST')
def app_sign_up(request):
    """
    Allow 3rd party app to create private accounts directly.  They must
    have user account names of the form:  appid_username

    username: string
    secret: sha1-string
    email: string
    verifyEmail: boolean
    """
    validate_only = get_bool(request.POST, 'validate', False)
    username = request.POST.get('username', '')

    try:
        if not app_username_match(username):
            raise ValidationError().add_error('username', "Invalid username: '%s'" % username)
        user_app_id = username.split('_')[0]
        if user_app_id != request.app.get_app_id():
            raise ValidationError().add_error('username',
                "Application prefix must be '%s' (not '%s')" % (request.app.get_app_id(),
                                                            user_app_id))
        if request.POST.get('email', '') == '':
            raise ValidationError().add_error('email', "Email address is required.")

        if User.lookup(username):
            raise ValidationError().add_error('username', "Username %s already exists." % username,
                                              status=409)

        user = User(key_name=username.lower(),
                    username=username,
                    email=request.POST['email'],
                    password=request.POST.get('secret', ''))
        if validate_only:
            user.validate()
        else:
            user.put()
    except (ValueError, BadValueError), error:
        result = {'statusText': unicode(error)}
        status = 400
        if hasattr(error, 'status'):
            status = error.status
        if hasattr(error, 'errors'):
            result['errors'] = error.errors
        return HttpJSONResponse(result, status=status)

    return HttpJSONResponse({'statusText': "User %s created." % username},
                            status=201)


@login_required
@method_required('GET', 'POST')
def account(request, username):
    """
    Edit your account information.
    """
    req_username = request.user.get_username()
    if username is None:
        username = req_username
    user = User.lookup(username)
    if user is None or \
        not (request.user.is_admin or
             req_username in settings.SUPER_USERS or
             req_username == username):
        return AccessDenied(request)

    if request.method == 'POST':
        form = ProfileForm(request.POST)
    else:
        form = ProfileForm(initial=user.get_form_dict())

    form.enable_fields(request.user)

    # Return HTML form for GET requests.
    if request.method == 'GET':
        response = render_to_response(request, 'auth/account.html', {
                'form': form})
        return response

    # Return form errors as JSON.
    if not form.is_valid():
        return HttpJSONResponse(form.errors_dict())

    # Return empty errors object for validate.
    if 'validate' in request.POST:
        return HttpJSONResponse({})

    form.save()

    # TODO: Enable changing email address - send to old and new
    # and record last verified address - puts account into unverified state?
    # send_email_verification(request, user)

    return HttpJSONResponse({'statusText': "Updated."})


@method_required('GET')
def sign_in(request, app_id=None):
    """
    Present the user with a sign-in page (for www.pageforest.com
    and/or to sign in to an application).

    Note that the app accomplishes sign-in completely through
    AJAX and calling the low-level challenge/response interface.
    """
    app = None
    if app_id:
        app = App.lookup(app_id)
        if app is None or app.is_www():
            return HttpResponseRedirect(reverse(sign_in))

    response = render_to_response(request, 'auth/sign-in.html',
        {
        'cross_app': app,
        })
    return response


@method_required('GET')
def get_app_session_key(request, app_id=None):
    if not referer_is_trusted(request):
        return AccessDenied(request)
    app = App.lookup(app_id)
    if app is None:
        return HttpJSONResponse({'statusText': "Invalid application."}, status=400)
    if request.user is None:
        return HttpJSONResponse({'statusText': "User not signed in."}, status=400)
    return HttpJSONResponse({'sessionKey': request.user.generate_session_key(app)})


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
    response.delete_cookie(settings.SESSION_USER_NAME)
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

    When memcache is unavailable, replays will be allowed
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
    response.set_cookie(settings.SESSION_USER_NAME, user.get_username(),
                        path=settings.SESSION_COOKIE_PATH,
                        max_age=settings.SESSION_COOKIE_AGE)
    response.set_cookie(settings.SESSION_COOKIE_NAME, session_key,
                        max_age=settings.SESSION_COOKIE_AGE)
    response.set_cookie(settings.REAUTH_COOKIE_NAME, reauth_cookie,
                        max_age=settings.REAUTH_COOKIE_AGE)
    return response
