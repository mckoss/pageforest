from datetime import datetime

from django.conf import settings
from django.http import HttpResponseForbidden

from utils import crypto

from auth.models import User


class AuthMiddleware(object):

    def process_request(self, request):
        """
        Attempt to extract the user from the session cookie into request.user.

        If fails for any reason, request.user is set to None (fails silently).
        """
        request.user = None
        if settings.SESSION_COOKIE_NAME not in request.COOKIES or \
                not hasattr(request, 'app'):
            return
        session_key = request.COOKIES[settings.SESSION_COOKIE_NAME]
        request.user = request.app.user_from_session_key(session_key)
