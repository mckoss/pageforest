import logging

from django.http import HttpResponseBadRequest

from chunks.models import MAX_CHUNK_SIZE


class PostMiddleware(object):
    """
    Convert POST requests for /post/ into PUT or PUSH for blobs.
    """

    def process_request(self, request):
        if request.method != 'POST':
            return
        if request.path_info not in ['/app/post/', '/app/admin/post/']:
            return
        # Check that the path is set properly.
        if 'path' not in request.POST:
            return HttpResponseBadRequest(
                'The form field with name="path" is missing.')
        path = request.POST['path']
        path = '/app/' + path.lstrip('/')
        path = path.rstrip('/') + '/'
        # Check that the method is set properly.
        method = request.POST.get('method', 'PUT').upper()
        if method not in ['PUT', 'PUSH']:
            return HttpResponseBadRequest(
                'The method must be PUT or PUSH.')
        # Check that the upload contains exactly one file.
        if not request.FILES:
            return HttpResponseBadRequest(
                "File upload not recognized. Please use multipart/form-data.")
        if len(request.FILES) > 1:
            return HttpResponseBadRequest(
                "File upload cannot contain more than one file per request.")
        if 'data' not in request.FILES:
            return HttpResponseBadRequest(
                'The upload field with name="data" is missing.')
        upload = request.FILES['data']
        path += upload.name
        if upload.size > MAX_CHUNK_SIZE:
            return HttpResponseBadRequest(
                "File upload cannot be larger than %d bytes." % MAX_CHUNK_SIZE)
        # Rewrite the request to HTTP PUT.
        logging.info("Rewriting POST to %s for %s (%d bytes)",
                     method, path, upload.size)
        request.method = method
        request.path_info = path
        request.META['PATH_INFO'] = request.path_info
        request.path = request.META['SCRIPT_NAME'] + request.path_info
