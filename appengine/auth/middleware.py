import re

from django.conf import settings
from django.http import HttpResponseForbidden

from auth import SignatureError
from auth.models import User
from apps.middleware import app_id_from_trusted_domain

APP_JSON_REGEX = re.compile(r'^/apps/(%s)/app.json/$' % settings.APP_ID_REGEX)


class AccessDenied(HttpResponseForbidden):

    def __init__(self, request, message="Access denied."):
        if hasattr(request, 'referer_error'):
            message += ' ' + request.referer_error
        if hasattr(request, 'session_key_error'):
            message += ' ' + request.session_key_error
        super(AccessDenied, self).__init__(message)


def referer_is_trusted(request):
    """
    Check the referer for this request.
    """
    if 'HTTP_REFERER' not in request.META:
        request.referer_error = "Missing Referer header."
        return False
    referer = request.META['HTTP_REFERER'].strip()
    if not referer:
        request.referer_error = "Empty Referer header."
        return False
    if referer.count('/') < 2:
        request.referer_error = "Invalid Referer header."
        return False
    hostname = referer.split('/')[2].split(':')[0]
    app_id = app_id_from_trusted_domain(hostname)
    if app_id == 'www':
        # Always trust the www front-end.
        return True
    if app_id == request.app.get_app_id():
        # Trust the default domain for this app.
        return True
    for trusted_url in request.app.trusted_urls:
        # TODO: Accept https: if trusted_url starts with http:
        if referer.startswith(trusted_url):
            # Explicitly trusted by the app developer.
            return True
    request.referer_error = "Untrusted Referer domain: %s." % hostname
    return False


def check_permissions(request, resource, method_override=None):
    """
    Check read or write permissions for the current user.
    """
    method = method_override or request.method
    if method in ['GET', 'HEAD', 'LIST', 'SLICE']:
        if 'public' not in resource.readers:
            if not referer_is_trusted(request):
                return AccessDenied(request)
        if not resource.is_readable(request.user):
            return AccessDenied(request)
    else:
        if not referer_is_trusted(request):
            return AccessDenied(request)
        if not resource.is_writable(request.user):
            return AccessDenied(request)


class AuthMiddleware(object):
    """
    Check authentication for each request.
    """

    def process_request(self, request):
        """
        Attempt to extract the user from the session cookie into
        request.user. Then check read or write permissions for the
        current app or document.

        If the session cookie is invalid, request.user is set to None
        and the error message is stored in request.session_key_error.
        The permissions check may still succeed (e.g. for public
        readable documents), but if it fails the stored error message
        is returned with status 403 Forbidden.
        """
        request.user = None
        if settings.SESSION_COOKIE_NAME in request.COOKIES:
            try:
                request.user = User.verify_session_key(
                    request.COOKIES[settings.SESSION_COOKIE_NAME],
                    request.app)
            except SignatureError, error:
                request.session_key_error = "Invalid %s cookie: %s" % (
                    settings.SESSION_COOKIE_NAME, unicode(error))
                assert request.user is None

        if APP_JSON_REGEX.match(request.path_info):
            # Permissions will be checked in the view function.
            return

        if hasattr(request, 'doc'):
            if request.doc is None:
                assert request.method == 'PUT'
                # Check app read permissions before creating a document.
                # Application readers = document creators.
                if request.user is None:
                    return AccessDenied(request)
                return check_permissions(request, request.app, 'GET')
            else:
                # Check permissions for current document or its blob store.
                return check_permissions(request, request.doc)

        # Check permissions for the current app.
        return check_permissions(request, request.app)


def user_context(request):
    """
    Make the logged in user available as {{ user }} in templates.
    """
    if hasattr(request, 'user') and request.user:
        return {'user': request.user}
    return {}
