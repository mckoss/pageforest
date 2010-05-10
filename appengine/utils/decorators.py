import logging
import time
import email
import httplib
from urlparse import urlparse

from django.http import HttpResponse, Http404, HttpResponseNotFound, \
    HttpResponseNotAllowed, HttpResponseServerError
from django.utils import simplejson as json

from google.appengine.ext import db

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


def jsonp(func):
    """
    View function decorator to wrap successful JSON response in a
    callback for JSONP.
    """
    def wrapper(request, *args, **kwargs):
        # Check if the query string contains a callback parameter.
        callback = request.GET.get('callback', None)
        if callback is None:
            return func(request, *args, **kwargs)

        referer = request.META.get('HTTP_REFERER', '')
        if not referer_is_safe(request, referer):
            return AccessDenied(request,
                                "Request from untrusted domain: %s" % referer)

        # Try to generate a response.
        try:
            response = func(request, *args, **kwargs)
        except Http404, error:
            response = HttpResponseNotFound(unicode(error))
        except Exception, error:
            logging.error("JSONP exception handler: " + unicode(error))
            response = HttpResponseServerError("Application error.")
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
            content = json.dumps(content)

        # Add the requested callback function.
        response.content = callback + '(' + content + ')'
        response['Content-Type'] = 'application/javascript'
        return response
    return wrapper


def referer_is_safe(request, referer):
    """
    Check the referer for trusted domains (for JSONP calls).
    """
    # Any of our domains are trusted as well as localhost
    # referers - so developers can test offline.
    # We are permissive to empty referers - so developers
    # can test on localhost.  Log these cases to see
    # what's happening.
    parts = urlparse(referer)
    domain = parts[1]
    if domain == '':
        logging.warn("Missing Referer - UA: %s" %
                     request.META.get('HTTP_USER_AGENT', 'missing'))
        return True

    if domain in settings.DOMAINS:
        return True
    for pf_domain in settings.DOMAINS:
        if domain.endswith('.' + pf_domain):
            return True

    app = request.app
    if app.is_www():
        return False

    # If we're running on an application domain, we trust any of
    # the developer's listed domains.
    if domain in app.domains:
        return True
    # REVIEW: Don't trust all subdomains by default - only if developer
    # indicates to do so with . prefix?
    for app_domain in app.domains:
        if domain.endswith('.' + app_domain):
            return True

    # TODO: We should actually be trusting specific URL prefixes
    # designated by the application - since he may not want to trust
    # every page on his host (e.g., github.com).

    return False


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
