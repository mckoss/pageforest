import logging

from django.conf import settings
from django.http import HttpResponseNotFound

from utils.views import reserved_url

from apps.models import App

DEBUG_URL_REWRITE = False


def app_id_from_trusted_domain(hostname):
    """
    Return the first subdomain part if the rest is listed in
    settings.DOMAINS (ignoring optional port numbers like :8080).
    """
    parts = hostname.split(':')[0].split('.')
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
        # Extract special subdomains from hostname.
        if request.path_info.startswith('/' + settings.ADMIN_SUBDOMAIN + '/'):
            return reserved_url(request)
        request.subdomain = None
        parts = hostname.split('.')
        if parts[0] == settings.ADMIN_SUBDOMAIN:
            request.subdomain = parts[0]
            hostname = '.'.join(parts[1:])
        # Extract app_id from hostname.
        app_id = app_id_from_trusted_domain(hostname)
        if app_id is None:
            return HttpResponseNotFound(
                "Domain not in settings.DOMAINS: " + hostname)

        request.app = App.lookup(app_id)
        if request.app is None and request.path_info == '/auth/challenge/':
            # Create a dummy app with a secret for challenge authentication.
            request.app = App.create(app_id)
            # FIXME: This is creating apps in the database for each challenge?
            request.app.put()
        if request.app is None:
            return HttpResponseNotFound(
                "Application not found for hostname: " + hostname)

        if request.app.is_www():
            # Don't allow references to internal re-written URIs.
            if request.path_info.startswith('/app/'):
                return HttpResponseNotFound("URL reserved for internal use.")
        else:
            if settings.DEBUG and DEBUG_URL_REWRITE:
                logging.info(" original URL: http://" +
                             request.META.get('HTTP_HOST', '') +
                             request.get_full_path())
            # Prefix path with special subdomains.
            if request.subdomain:
                request.path_info = '/' + request.subdomain + request.path_info
            # Prefix path with /app for matching with urls.py.
            request.path_info = '/app' + request.path_info
            request.META['PATH_INFO'] = request.path_info
            request.path = request.META['SCRIPT_NAME'] + request.path_info
            if settings.DEBUG and DEBUG_URL_REWRITE:
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
