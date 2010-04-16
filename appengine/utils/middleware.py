import logging

from django.conf import settings
from django.http import HttpResponseNotFound

from apps.models import App


class AppMiddleware(object):

    def process_request(self, request):
        hostname = request.META.get('HTTP_HOST', 'testserver').split(':')[0]
        if hostname.startswith('www.'):
            hostname = hostname[4:]
        if (hostname == settings.DEFAULT_DOMAIN or
            hostname in ['localhost', 'testserver']):
            return
        request.app = App.get_by_hostname(hostname)
        if request.app is None:
            app_id = hostname.split('.')[0]
            request.app = App(key_name=app_id, app_id=app_id)
        logging.info("before: " + request.path + " " + request.path_info)
        request.path_info = '/app' + request.path_info
        request.META['PATH_INFO'] = request.path_info
        request.path = request.META['SCRIPT_NAME'] + request.path_info
        logging.info("after: " + request.path + " " + request.path_info)
