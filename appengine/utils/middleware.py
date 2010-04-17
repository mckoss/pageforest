import logging

from django.conf import settings
from django.http import HttpResponseNotFound

from apps.models import App
from documents.models import Document


class AppMiddleware(object):

    def process_request(self, request):
        hostname = request.META.get('HTTP_HOST', 'testserver').split(':')[0]
        if hostname.startswith('www.'):
            hostname = hostname[4:]
        if hostname in (settings.DEFAULT_DOMAIN, 'localhost'):
            return  # Front-end (www.pageforest.com).
        # Find the app by hostname.
        request.app = App.get_by_hostname(hostname)
        if request.app is None:
            app_id = hostname.split('.')[0]
            request.app = App(key_name=app_id, app_id=app_id)
        # Rewrite paths with .global to the meta app.
        logging.info("original path: " + request.path_info)
        if request.path_info == '/':
            request.path_info = '/.global/index.html'
        parts = request.path_info.split('/')
        if parts[1] == '.global':
            parts[1] = request.app.key().name()
            request.path_info = '/'.join(parts)
            request.app = App.get_by_key_name('meta')
        # Prefix path with /app for matching with urls.py.
        request.path_info = '/app' + request.path_info
        request.META['PATH_INFO'] = request.path_info
        request.path = request.META['SCRIPT_NAME'] + request.path_info
        logging.info("rewritten path: " + request.path_info)
        # Load the document.
        request.app_id = request.app.key().name()
        request.doc_id = parts[1]
        request.doc = Document.get_by_key_name(request.doc_id)
