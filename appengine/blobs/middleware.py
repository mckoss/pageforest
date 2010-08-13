import logging

from django.http import HttpResponse
from django.conf import settings

from chunks.models import MAX_CHUNK_SIZE


class PostMiddleware(object):
    """
    Convert POST requests for /post/ into PUT or PUSH for blobs.
    """

    def error(self, message):
        return HttpResponse('{"status": 400, "statusText": "%s"}' % message,
                            mimetype='text/plain')

    def process_request(self, request):
        if request.method != 'POST':
            return
        if request.path_info not in ['/app/post/', '/app/admin/post/']:
            return
        # Check that the path is set properly.
        if 'path' not in request.POST:
            return self.error('The form field with name="path" is missing.')
        path = request.POST['path']
        path = '/app/' + path.lstrip('/')
        path = path.rstrip('/') + '/'
        # Check that the method is set properly.
        method = request.POST.get('method', 'PUT').upper()
        if method not in ['PUT', 'PUSH']:
            return self.error('The method must be PUT or PUSH.')
        # Check that the upload contains exactly one file.
        if not request.FILES:
            return self.error(
                "File upload not recognized. Please use multipart/form-data.")
        if len(request.FILES) > 1:
            return self.error(
                "File upload cannot contain more than one file per request.")
        if 'data' not in request.FILES:
            return self.error(
                'The upload field with name="data" is missing.')
        upload = request.FILES['data']
        path += upload.name
        if upload.size > MAX_CHUNK_SIZE:
            return self.error(
                "File upload cannot be larger than %d bytes." % MAX_CHUNK_SIZE)
        # Rewrite the request to HTTP PUT.
        logging.info("Rewriting POST to %s for %s (%d bytes)",
                     method, path, upload.size)
        request.method = method
        request.path_info = path
        request.META['PATH_INFO'] = request.path_info
        request.path = request.META['SCRIPT_NAME'] + request.path_info


    def process_response(self, request, response):
        if response['Content-Type'] == settings.JSON_MIMETYPE:
            response['Content-Type'] = 'text/plain'
        return response
