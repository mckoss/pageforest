from django.http import HttpResponseForbidden

from auth.middleware import AccessDenied


def login_required(func):
    """
    View function decorator to check session key for valid signed in
    user account.
    """
    def wrapper(request, *args, **kwargs):
        if request.user is None:
            return AccessDenied(request)
        return func(request, *args, **kwargs)
    return wrapper
