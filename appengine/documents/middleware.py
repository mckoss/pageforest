from django.conf import settings

from documents.models import Doc


class DocMiddleware(object):

    def process_request(self, request):
        parts = request.path_info.split('/')
        if len(parts) < 4 or parts[1] != 'app' or parts[2] != 'docs':
            return
        doc_id = parts[3]
        key_name = '/'.join((request.app.get_app_id(), doc_id.lower()))
        request.doc = Doc.get_by_key_name(key_name)
        if request.doc is None:
            # TODO: Return HttpResponseNotFound instead.
            request.doc = Doc(key_name=doc_id)
