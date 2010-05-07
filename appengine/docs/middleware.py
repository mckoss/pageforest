from django.http import HttpResponseNotFound

from docs.models import Doc


class DocMiddleware(object):

    def process_request(self, request):
        parts = request.path_info.split('/')
        if len(parts) < 4 or parts[1] != 'app' or parts[2] != 'docs':
            return
        doc_id = parts[3]
        key_name = '/'.join((request.app.get_app_id(), doc_id.lower()))
        request.doc = Doc.get_by_key_name(key_name)
        if request.doc is None:
            # The document was not found in the datastore, return 404
            # unless this request is going to create it.
            if request.method != 'PUT' or len(parts) != 4:
                return HttpResponseNotFound("Document not found: " + doc_id)
