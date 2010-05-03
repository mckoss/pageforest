from django.conf import settings


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
        request.user = request.app.user_from_session_key(session_key)


def user_context(request):
    """
    Make the logged in user available as {{ user }} in templates.
    """
    return {'user': request.user}
