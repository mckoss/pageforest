import re

from django.conf import settings
from django.http import HttpResponseNotFound

from docs.models import Doc

# If this matches request.path_info, it is a doc or blob request, and
# DocMiddleware will attempt to load request.doc from the datastore.
DOC_BLOB_REGEX = re.compile(r'^/app/docs/(%s)(/.*)?$' % settings.DOC_ID_REGEX)

# If this matches request.path_info, it is a doc request without blob.
DOC_REGEX = re.compile(r'^/app/docs/(%s)/?$' % settings.DOC_ID_REGEX)


class DocMiddleware(object):

    def process_request(self, request):
        """
        Load the document for this request, if required.

        The following paths will have request.doc loaded for doc_id:
        /app/docs/doc_id/
        /app/docs/doc_id/blob/key/with/slashes/
        /app/docs/doc_id/blob.json/
        """
        match = DOC_BLOB_REGEX.match(request.path_info)
        if match is None:
            # This request is not for document or blob storage.
            return

        # Try to load the document for this request.
        doc_id = match.group(1)
        key_name = '/'.join((request.app.get_app_id(), doc_id.lower()))
        request.doc = Doc.get_by_key_name(key_name)

        if request.doc:
            # The document was found.
            return

        if request.method == 'PUT' and DOC_REGEX.match(request.path_info):
            # This request is going to create the document.
            assert request.doc is None
            return

        return HttpResponseNotFound("Document not found: " + key_name)
