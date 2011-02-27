import logging
import time
import email
import httplib

from django.conf import settings
from django.http import HttpResponse, Http404, HttpResponseNotFound, \
    HttpResponseNotAllowed, HttpResponseServerError
from django.utils import simplejson as json

from google.appengine.ext import db

from utils.json import HttpJSONResponse, update_jsonp_response

import settings
from auth.middleware import AccessDenied


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


def no_cache(func):
    """
    Disable caching of the response.
    """
    def wrapper(*args, **kwargs):
        response = func(*args, **kwargs)
        if isinstance(response, HttpResponse):
            response['Cache-Control'] = 'no-cache'
            return response
    return wrapper


def jsonp(func):
    """
    View function decorator to wrap successful JSON response in a
    callback for JSONP.
    """
    def wrapper(request, *args, **kwargs):
        # Check if the query string contains a callback parameter.
        callback = request.GET.get('callback', None)

        # Try to generate a response.
        try:
            response = func(request, *args, **kwargs)
            if callback is None:
                return response
        except Http404, error:
            response = HttpJSONResponse({'statusText': unicode(error)}, status=404)
        except ValueError, error:
            response = HttpJSONResponse({'statusText': unicode(error)}, status=400)
        except Exception, error:
            logging.error("JSONP exception handler: " + unicode(error))
            response = HttpJSONResponse({'statusText': unicode(error)}, status=500)

        series = (response.status_code / 100) * 100

        # Send redirects and not-modified directly back to the client
        if series in (100, 300):
            return response

        response = update_jsonp_response(request, response)
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
                methods_list = list(methods)
                methods_list.sort()
                logging.info("%s not allowed - must be one of %r" %
                             (request.method, methods_list))
                return HttpResponseNotAllowed(methods_list)
            return func(request, *args, **kwargs)
        return wrapper
    return decorate
