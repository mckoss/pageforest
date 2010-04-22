import logging

from django.conf import settings
from django.http import HttpResponseNotFound

from documents.models import Document


class DocMiddleware(object):

    def process_request(self, request):
        parts = request.path_info.split('/')
        if len(parts) < 3 or parts[1] != 'app':
            return
        request.doc_id = parts[2]
        request.doc = Document.get_by_key_name(
            '/'.join((request.app_id, request.doc_id.lower())))
        if request.doc is None and settings.DEBUG:
            request.doc = Document(key_name=request.doc_id)
