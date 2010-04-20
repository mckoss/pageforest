from datetime import datetime

from django.conf import settings
from django.http import HttpResponseForbidden

from auth.models import User


class AuthMiddleware(object):

    def process_request(self, request):
        if settings.SESSION_COOKIE_NAME not in request.COOKIES:
            return
        session_key = request.COOKIES[settings.SESSION_COOKIE_NAME]
        parts = session_key.split('$')
        if len(parts) != 4:
            return HttpResponseForbidden("Session key must have 4 parts.")
        # Check the expiration time.
        expires = datetime.strptime(parts[2], "%Y-%m-%dT%H:%M:%SZ")
        if expires < datetime.now():
            return HttpResponseForbidden("Session key is expired.")
        # Check the app id.
        app_id = parts[0]
        if hasattr(request, 'app_id') and request.app_id != app_id:
            return HttpResponseForbidden("Session key is for a different app.")
        # Check the username.
        username = parts[1]
        user = User.get_by_key_name(username.lower())
        if user is None:
            return HttpResponseForbidden("Session key user not found.")
        request.user = user
