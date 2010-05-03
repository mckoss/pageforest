from django.http import HttpResponseForbidden


def login_required(func):
    """
    View function decorator to check session key for valid signed in
    user account.
    """
    def wrapper(request, *args, **kwargs):
        if not hasattr(request, 'user'):
            return HttpResponseForbidden("Login is required.")
        return func(request, *args, **kwargs)
    return wrapper
