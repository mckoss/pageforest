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
        if request.path_info.startswith('/docs/'):
            if request.path_info.count('/') >= 3:
                return  # Don't mess with the key-value namespace.
        filename = os.path.basename(request.path_info)
        if not filename:
            return  # URL already ends with a slash.
        base, ext = os.path.splitext(filename)
        if base and not ext:
            # URL ends with /word without file extension, add slash.
            request.path_info += '/'
            request.META['PATH_INFO'] = request.path_info
            request.path = request.META['SCRIPT_NAME'] + request.path_info
