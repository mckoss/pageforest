import time
import email

from utils.json import probably_valid_json

from django.http import HttpResponse


def cache_expires(seconds):
    """
    View function decorator to add an "Expires" HTTP header:
    http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.21
    After this time, the user agent or proxy cache will have to be
    validated with the origin server.
    """
    def decorate(func):
        def wrapper(*args, **kwargs):
            response = func(*args, **kwargs)
            if isinstance(response, HttpResponse):
                expires = time.time() + seconds
                formatted = email.utils.formatdate(expires)[:26] + 'GMT'
                response['Expires'] = formatted
            return response
        return wrapper
    return decorate


def jsonp(func):
    """
    View function decorator to wrap successful JSON response in a
    callback for JSONP.
    """
    def wrapper(request, *args, **kwargs):
        response = func(request, *args, **kwargs)
        callback = request.GET.get('callback', None)
        if callback and response.status_code == 200:
            # Force valid JSON by adding double quotes if necessary.
            if not probably_valid_json(response.content):
                response.content = '"' + response.content + '"'
            # Add the requested callback function.
            response.content = callback + '(' + response.content + ')'
        return response
    return wrapper
