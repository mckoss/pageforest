from django.conf import settings
from django.http import HttpResponseForbidden

from auth.models import User, SignatureError


class AuthMiddleware(object):
    """
    Check authentication for each request.
    """

    def process_request(self, request):
        """
        Attempt to extract the user from the session cookie into
        request.user. If it fails for any reason, request.user is set
        to None (fails silently).
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


class AccessDenied(HttpResponseForbidden):

    def __init__(self, request, message="Access denied."):
        if hasattr(request, 'session_key_error'):
            message = request.session_key_error
        super(AccessDenied, self).__init__(message)


def user_context(request):
    """
    Make the logged in user available as {{ user }} in templates.
    """
    return {'user': request.user}
