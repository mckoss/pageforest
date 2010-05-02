import time
import email
import httplib

from django.http import HttpResponse, HttpResponseNotAllowed, Http404, \
    HttpResponseNotFound, HttpResponseServerError
from django.utils import simplejson as json

from google.appengine.ext import db


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
        try:
            response = func(request, *args, **kwargs)
        except Http404, e:
            response = HttpResponseNotFound(str(e))
        except Exception, e:
            response = HttpResponseServerError(str(e))

        # Check if the query string contains a callback parameter.
        callback = request.GET.get('callback', None)
        if not callback:
            return response

        # REVIEW: These could be a handfull if we return formatted 400 and
        # 500 pages back to the user.
        content = response.content
        # Tunnel HTTP errors using status code 200.
        if response.status_code / 100 != 2:
            content = json.dumps({
                "__class__": "Error",
                "status": response.status_code,
                "statusText": httplib.responses[response.status_code],
                "message": content,
                }, sort_keys=True, indent=4)
            response.status_code = 200
            response['Content-Type'] = 'application/json'

        # Encode arbitrary strings as valid JSON.
        if response['Content-Type'] != 'application/json':
            # Remove trailing newlines.
            content = content.rstrip('\n')
            content = json.dumps(content, indent=4)

        # Add the requested callback function.
        response.content = callback + '(' + content + ')'
        response['Content-Type'] = 'application/javascript'
        return response
    return wrapper


def method_required(*methods):
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
