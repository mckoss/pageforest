import logging

from django.conf import settings
from django.http import HttpResponseNotFound

from apps.models import App


def app_id_from_trusted_domain(hostname):
    """
    Return the first subdomain part if the rest is listed in
    settings.DOMAINS (ignoring optional port numbers like :8080).
    """
    parts = hostname.split(':')[0].split('.')
    # Remove well-known subdomains.
    if parts[0] in ('dev', 'docs'):
        parts = parts[1:]
    # Normalize App Engine deployment versions, e.g.
    # app_id.2010-05-12.latest.pageforest.appspot.com
    if (len(parts) == 6 and
        parts[2] == 'latest' and
        parts[4] == 'appspot' and
        parts[5] == 'com'):
        parts[1] = 'version'
    if '.'.join(parts[1:]) in settings.DOMAINS:
        return parts[0]


class AppMiddleware(object):
    """
    Hostname lookup to find the Pageforest app for each request.
    """

    def process_request(self, request):
        """
        Get the app by hostname.
        """
        default = 'www.' + settings.DEFAULT_DOMAIN
        hostname = request.META.get('HTTP_HOST', default)
        app_id = app_id_from_trusted_domain(hostname)
        if app_id is None:
            return HttpResponseNotFound(
                "Domain not in settings.DOMAINS: " + hostname)

        request.app = App.lookup(app_id)
        if request.app is None:
            return HttpResponseNotFound(
                "Application not found for hostname: " + hostname)

        if request.app.is_www():
            # Don't allow references to internal re-written URIs.
            if request.path_info.startswith('/app/'):
                return HttpResponseNotFound("URL reserved for internal use.")
        else:
            # Prefix path with /app for matching with urls.py.
            if settings.DEBUG:
                logging.info(" original URL: http://" +
                             request.META.get('HTTP_HOST', '') +
                             request.get_full_path())
            request.path_info = '/app' + request.path_info
            request.META['PATH_INFO'] = request.path_info
            request.path = request.META['SCRIPT_NAME'] + request.path_info
            if settings.DEBUG:
                logging.info("rewritten URL: http://" +
                             request.META.get('HTTP_HOST', '') +
                             request.get_full_path())

        # Unless AppMiddleware returned 404, request.app is always set.
        assert request.app is not None


def app_context(request):
    """
    Expose the app as {{ application }} to templates (but only for
    3rd party apps, not for 'www'.
    """
    if hasattr(request, 'app') and request.app and not request.app.is_www():
        return {'application': request.app}
    return {}
