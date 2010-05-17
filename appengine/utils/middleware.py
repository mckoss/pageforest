import threading

from django.conf import settings
from django.shortcuts import redirect

from utils.shortcuts import render_to_response


class ResponseNotFoundMiddleware(object):
    """
    Render HttpResponseNotFound (text/plain) into 404.html template.
    This work-around is required as long as Django does not let us
    raise Http404 from AppMiddleware or DocMiddleware.
    """

    def process_response(self, request, response):
        if response.status_code == 404 and '<html' not in response.content:
            request.exception = response.content
            response = render_to_response(request, '404.html', {})
            response.status_code = 404
        return response

    def process_exception(self, request, exception):
        request.exception = exception


class RequestMiddleware(object):
    """
    Save the request object in thread local storage to make it
    available to Django code outside the view function.
    """
    thread_local = None

    def process_request(self, request):
        RequestMiddleware.thread_local = threading.local()
        RequestMiddleware.thread_local.request = request
        if 'method' in request.GET:
            request.method = request.GET['method'].upper()

    @classmethod
    def get_request(cls):
        if not hasattr(RequestMiddleware.thread_local, 'request'):
            return None
        return RequestMiddleware.thread_local.request


class WwwMiddleware(object):
    """
    External redirect to prepend www to the host header if missing.

    Examples:
    http://localhost:8080/         => http://www.localhost:8080/
    https://pageforest.com/sign-in => https://www.pageforest.com/sign-in
    http://PGFR.ST/apps/?tag=foo   => http://www.pgfr.st/apps/?tag=foo
    """

    def process_request(self, request):
        if 'HTTP_HOST' not in request.META:
            return
        hostname = request.META['HTTP_HOST'].lower()
        # Remove port number if specified.
        normalized = hostname.split(':')[0]
        # Normalize App Engine deployment versions, e.g.
        # 2010-05-12.latest.pageforest.appspot.com
        parts = normalized.split('.')
        if (len(parts) == 5 and
            parts[1] == 'latest' and
            parts[3] == 'appspot' and
            parts[4] == 'com'):
            parts[0] = 'version'
            normalized = '.'.join(parts)
        # Check if the domain needs a subdomain (app_id or www).
        if normalized in settings.DOMAINS:
            # Redirect to prepend www.
            url = request.is_secure() and 'https:' or 'http:'
            url += '//www.' + hostname + request.get_full_path()
            return redirect(url)


class SlashMiddleware(object):
    """
    Add a trailing slash internally (without HTTP redirect)
    unless the URL ends with filename.ext or slash.
    """

    def process_request(self, request):
        path = request.path_info
        if path.endswith('/'):
            # URL already ends with a slash.
            return
        if path in ('/stats', '/shell'):
            # Redirect to add trailing slash for app.yaml handlers.
            return redirect(path + '/')
        # Add a trailing slash (internal redirect).
        request.path_info += '/'
        request.META['PATH_INFO'] = request.path_info
        request.path = request.META['SCRIPT_NAME'] + request.path_info
