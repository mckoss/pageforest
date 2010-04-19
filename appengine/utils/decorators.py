import time
import email

from django.http import HttpResponse, HttpResponseNotAllowed

from google.appengine.ext import db

from utils.json import probably_valid_json


def run_in_transaction(func):
    """
    Run the function in a datastore transaction. If the transaction
    cannot be committed, the function will be retried up to 3 times by
    the transaction handler. Avoid side effects!
    http://code.google.com/appengine/docs/python/datastore/functions.html
    """
    def wrapper(*args, **kwargs):
        return db.run_in_transaction(func, *args, **kwargs)
    return wrapper


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
            content = response.content
            # Remove or escape newlines.
            content = content.rstrip('\n').replace('\n', r'\n')
            # Force valid JSON by adding double quotes if necessary.
            if not probably_valid_json(content):
                content = '"' + content + '"'
            # Add the requested callback function.
            response.content = callback + '(' + content + ')'
            response['Content-Type'] = 'application/javascript'
        return response
    return wrapper


def require_method(*methods):
    """
    Check that request.method is allowed, otherwise return
    405 Method Not Allowed with a list of allowed methods.
    """
    def decorate(func):
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return HttpResponseNotAllowed(methods)
            return func(request, *args, **kwargs)
        return wrapper
    return decorate
