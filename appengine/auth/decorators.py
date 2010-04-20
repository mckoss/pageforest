from django.http import HttpResponseForbidden


def login_required(func):
    def wrapper(request, *args, **kwargs):
        if 'session_key' not in request.COOKIES:
            return HttpResponseForbidden("Login is required.")
        session_key = request.COOKIES['session_key']
        return func(request, *args, **kwargs)
    return wrapper
