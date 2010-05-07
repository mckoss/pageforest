import logging
import threading

from django.template.loader import render_to_string
from utils.shortcuts import render_to_response


class RequestMiddleware(object):
    thread_local = None

    def process_request(self, request):
        self.thread_local = threading.local()
        self.thread_local.request = request

    @classmethod
    def get_request(cls):
        if not hasattr(cls.thread_local, 'request'):
            return None
        return cls.thread_local.request


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
        if path.startswith('/docs/') and '/' in path[6:]:
            # Don't mess with the key-value namespace.
            return
        filename = path.split('/')[-1]
        if filename and '.' not in filename:
            # URL ends with /word without file extension.
            # Add a trailing slash (internal redirect).
            request.path_info += '/'
            request.META['PATH_INFO'] = request.path_info
            request.path = request.META['SCRIPT_NAME'] + request.path_info


class ExceptionMiddleware(object):
    """
    Stash information about any thrown exceptions into the request
    object so it can be used by the 404, 500, and json templates.
    """

    def process_exception(self, request, exception):
        request.exception = exception


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
