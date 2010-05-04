import os
import threading


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
