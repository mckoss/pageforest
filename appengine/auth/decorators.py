import urllib

from django.http import HttpResponseForbidden, HttpResponseRedirect

from auth.middleware import AccessDenied


def login_required(func):
    """
    View function decorator to check session key for valid signed in
    user account.
    """
    def wrapper(request, *args, **kwargs):
        if request.user is None:
            return HttpResponseRedirect(
                '/sign-in/?continue=' + urllib.quote_plus(request.path))
        return func(request, *args, **kwargs)
    return wrapper
