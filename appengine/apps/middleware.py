import logging

from django.conf import settings
from django.http import Http404

from apps.models import App


class AppMiddleware(object):

    def process_request(self, request):
        # Get the app by hostname.
        hostname = request.META.get('HTTP_HOST', 'testserver').split(':')[0]
        if hostname.startswith('www.'):
            hostname = hostname[4:]
        if hostname in (settings.DEFAULT_DOMAIN,
                        'localhost', 'pageforest', 'testserver'):
            # Don't allow references to internal re-written uri's
            if request.path_info.startswith('/app/'):
                raise Http404
            return  # Front-end (www.pageforest.com).
        request.app = App.get_by_hostname(hostname)
        request.app_id = request.app.key().name()
        # Rewrite / to default HTML page.
        logging.info(" original URL: http://" +
                     request.META.get('HTTP_HOST', '') +
                     request.get_full_path())
        if request.path_info == '/':
            request.path_info = '/index.html'
        # Prefix path with /app for matching with urls.py.
        request.path_info = '/app' + request.path_info
        request.META['PATH_INFO'] = request.path_info
        request.path = request.META['SCRIPT_NAME'] + request.path_info
        logging.info("rewritten URL: http://" +
                     request.META.get('HTTP_HOST', '') +
                     request.get_full_path())
        # print request.get_full_path()
