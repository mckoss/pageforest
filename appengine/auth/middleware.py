import re

from django.conf import settings
from django.http import HttpResponseForbidden

from auth.models import User, SignatureError
from docs.middleware import DOC_REGEX

SIGN_IN_REGEX = re.compile(r'^/sign-(up|in)/')
APP_JSON_REGEX = re.compile(r'^/apps/(%s)/app.json$' % settings.APP_ID_REGEX)


class AccessDenied(HttpResponseForbidden):

    def __init__(self, request, message="Access denied."):
        if hasattr(request, 'session_key_error'):
            message = request.session_key_error
        super(AccessDenied, self).__init__(message)


def check_permissions(request, resource, method_override=None):
    """
    Check read or write permissions for the current user.
    """
    method = method_override or request.method
    if method in ['GET', 'HEAD', 'SLICE']:
        if not resource.is_readable(request.user):
            return AccessDenied(request)
    else:
        if not resource.is_writable(request.user):
            return AccessDenied(request)


class AuthMiddleware(object):
    """
    Check authentication for each request.
    """

    def process_request(self, request):
        """
        Attempt to extract the user from the session cookie into
        request.user. If it fails for any reason, request.user is set
        to None (fails silently). Then check read or write permissions
        for the current app or document.
        """
        request.user = None
        if settings.SESSION_COOKIE_NAME not in request.COOKIES:
            return
        session_key = request.COOKIES[settings.SESSION_COOKIE_NAME]
        try:
            request.user = User.verify_session_key(session_key, request.app)
        except SignatureError, error:
            request.session_key_error = "Invalid %s cookie: %s" % (
                settings.SESSION_COOKIE_NAME, unicode(error))
            assert request.user is None

        if SIGN_IN_REGEX.match(request.path_info) and request.method == 'POST':
            # Allow anonymous users to POST to the sign-in pages.
            return

        if APP_JSON_REGEX.match(request.path_info):
            # Permissions will be checked in the view function.
            return

        if DOC_REGEX.match(request.path_info) and request.doc is None \
                and request.method == 'PUT':
            # Check app read permissions before creating a document.
            return check_permissions(request, request.app, 'GET')

        if hasattr(request, 'doc'):
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
