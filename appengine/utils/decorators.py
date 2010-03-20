import time
import email

from django.http import HttpResponse


def cache_expires(seconds):
    """
    Add a HTTP header with an expiration timestamp:
    http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.21
    After this time, the user agent or proxy cache will have to be
    validated with the origin server.
    """
    def decorate(f):
        def wrapper(*args, **kwargs):
            response = f(*args, **kwargs)
            if isinstance(response, HttpResponse):
                expires = time.time() + seconds
                formatted = email.utils.formatdate(expires)[:26] + 'GMT'
                response['Expires'] = formatted
            return response
        return wrapper
    return decorate
