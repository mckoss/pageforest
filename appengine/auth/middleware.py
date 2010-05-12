from django.conf import settings
from django.http import HttpResponseForbidden

from auth.models import User, SignatureError

READ_METHODS = ['GET', 'HEAD', 'SLICE']


class AccessDenied(HttpResponseForbidden):

    def __init__(self, request, message="Access denied."):
        if hasattr(request, 'session_key_error'):
            message = request.session_key_error
        super(AccessDenied, self).__init__(message)


def check_permissions(request, resource):
    """
    Check read or write permissions for the current user.
    """
    if request.method in READ_METHODS:
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

        if hasattr(request, 'doc'):
            # Check permissions for current document or its blob store.
            return check_permissions(request, request.doc)

        if not request.app.is_www():
            # Check permissions for the current app.
            return check_permissions(request, request.app)


def user_context(request):
    """
    Make the logged in user available as {{ user }} in templates.
    """
    if hasattr(request, 'user') and request.user:
        return {'user': request.user}
    return {}
