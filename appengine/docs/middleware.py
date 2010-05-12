from django.http import HttpResponseNotFound

from docs.models import Doc


class DocMiddleware(object):

    def process_request(self, request):
        """
        Load the document for this request, if required.

        Example path: /app/docs/doc_id/

        FIXME: What about /app/docs/doc.txt
        """
        parts = request.path_info.split('/')
        if len(parts) < 5 or parts[1] != 'app' or parts[2] != 'docs':
            return
        doc_id = parts[3]
        key_name = '/'.join((request.app.get_app_id(), doc_id.lower()))
        request.doc = Doc.get_by_key_name(key_name)
        if request.doc is None and request.method == 'PUT' and len(parts) == 5:
            # This request is going to create the document.
            # Create a dummy document that passes the permissions
            # check in AuthMiddleware.
            request.doc = Doc(key_name=key_name, writers=['public'])
            # FIXME: This will stay public if the upload doesn't
            # include writers.
            # FIXME: Only app readers should be able to create docs.
            return
        # Check that the document exists.
        if request.doc is None:
            return HttpResponseNotFound("Document not found: " + key_name)
