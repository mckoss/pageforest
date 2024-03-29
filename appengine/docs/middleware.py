import re
import logging

from django.conf import settings
from django.http import HttpResponseNotFound, HttpResponseForbidden

from docs.models import Doc

from utils.json import update_jsonp_response

# If this matches request.path_info, it is a doc or blob request, and
# DocMiddleware will attempt to load request.doc from the datastore.
DOC_BLOB_REGEX = re.compile(r'^/app/docs/(%s)(/.*)?$' % settings.DOC_ID_REGEX)

# If this matches request.path_info, it is a doc request without blob.
DOC_REGEX = re.compile(r'^/app/docs/(%s)/?$' % settings.DOC_ID_REGEX)


class DocMiddleware(object):

    def process_request(self, request):
        """
        Load the document for this request, if required.

        Sets:

        request.doc

        The following paths will have request.doc loaded for doc_id:
        /app/docs/doc_id/
        /app/docs/doc_id/blob/key/with/slashes/
        /app/docs/doc_id/blob.json/
        """
        match = DOC_BLOB_REGEX.match(request.path_info)
        if match is None:
            # This request is not for document or blob storage.
            return

        # For apps that require ssl data access - enforce the restriction here
        if request.app.secure_data and not request.is_secure():
            return HttpResponseForbidden("Data access requires and SSL connection.")

        # Try to load the document for this request.
        doc_id = match.group(1)
        key_name = '/'.join((request.app.get_app_id(), doc_id.lower()))
        request.doc = Doc.get_by_key_name(key_name)

        if request.doc:
            if not request.doc.deleted:
                # Found
                return
            else:
                # Tombstone - treat as not found.
                request.doc = None

        if request.method == 'PUT' and DOC_REGEX.match(request.path_info):
            # This request is going to create the document.
            assert request.doc is None
            return

        response = HttpResponseNotFound("Document not found: " + key_name)
        return update_jsonp_response(request, response)
