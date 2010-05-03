from django.conf import settings

from documents.models import Document


class DocMiddleware(object):

    def process_request(self, request):
        parts = request.path_info.split('/')
        if len(parts) < 4 or parts[1] != 'app' or parts[2] != 'docs':
            return
        request.doc_id = parts[3]
        request.doc = Document.get_by_key_name(
            '/'.join((request.app.app_id(), request.doc_id.lower())))
        if request.doc is None and settings.DEBUG:
            request.doc = Document(key_name=request.doc_id)
