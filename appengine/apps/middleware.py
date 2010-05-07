import logging

from django.http import HttpResponseNotFound

from apps.models import App


class AppMiddleware(object):
    """
    Hostname lookup to find the Pageforest app for each request.
    """

    def process_request(self, request):
        """
        Get the app by hostname.
        """
        request.app = App.get_by_hostname(
            request.META.get('HTTP_HOST', 'testserver'))

        if request.app is None:
            return HttpResponseNotFound("Application not found.")

        if request.app.is_www():
            # Don't allow references to internal re-written URIs.
            if request.path_info.startswith('/app/'):
                return HttpResponseNotFound("URL reserved for internal use.")
            return

        # Prefix path with /app for matching with urls.py.
        logging.info(" original URL: http://" +
                     request.META.get('HTTP_HOST', '') +
                     request.get_full_path())
        request.path_info = '/app' + request.path_info
        request.META['PATH_INFO'] = request.path_info
        request.path = request.META['SCRIPT_NAME'] + request.path_info
        logging.info("rewritten URL: http://" +
                     request.META.get('HTTP_HOST', '') +
                     request.get_full_path())


def app_context(request):
    """
    Expose the app as {{ application }} to templates (but only for
    3rd party apps - not for 'www'.
    """
    logging.info("App Context")
    if not request.app.is_www():
        return {'application': request.app}
    return {}
