import logging

from django.http import HttpResponseNotFound

from auth.middleware import AccessDenied

from docs.models import Doc

READ_METHODS = ['GET', 'HEAD', 'SLICE']
WRITE_METHODS = ['PUT', 'POST', 'DELETE', 'PUSH']


class DocMiddleware(object):

    def process_request(self, request):
        parts = request.path_info.split('/')
        if len(parts) < 5 or parts[1] != 'app' or parts[2] != 'docs':
            return
        doc_id = parts[3]
        key_name = '/'.join((request.app.get_app_id(), doc_id.lower()))
        request.doc = Doc.get_by_key_name(key_name)
        if request.doc is None and request.method == 'PUT' and len(parts) == 5:
            # This request is going to create the document.
            if request.user is None:
                return AccessDenied(request)
            return
        # Check that the document exists.
        if request.doc is None:
            return HttpResponseNotFound("Document not found: " + key_name)
        # Check document permissions before reading or writing.
        if request.method in READ_METHODS:
            if not request.doc.is_readable(request.user):
                return AccessDenied(request)
        elif request.method in WRITE_METHODS:
            if not request.doc.is_writable(request.user):
                return AccessDenied(request)
        else:
            logging.info("No access control for unknown request method:" +
                         request.method)
