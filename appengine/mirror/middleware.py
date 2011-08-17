import re

from django.conf import settings
from django.http import HttpResponseForbidden

from apps.middleware import app_id_from_trusted_domain
from apps.models import App

MIRROR_REGEX = re.compile('^/mirror/(%s)(/.*)?$' % settings.APP_ID_REGEX)


class MirrorMiddleware(object):
    """
    Cross-domain aliases for meta applications.
    """

    def process_request(self, request):
        if not request.path_info.startswith('/mirror/'):
            return
        # Only allow /mirror/ on special trusted domains.
        hostname = request.META['HTTP_HOST'] or 'unspecified'
        original_app_id = app_id_from_trusted_domain(hostname)
        if original_app_id not in settings.APPS_WITH_MIRROR:
            return HttpResponseForbidden(
                "Mirror is only available on trusted apps.")
        request.original_app = App.lookup(original_app_id)
        # Rewrite Host header and path for this request.
        match = MIRROR_REGEX.match(request.path_info)
        if not match:
            # This request should be handled directly by urls.py.
            return
        app_id = match.group(1)
        path = match.group(2) or '/'
        # Allow mirror access to docs on standard domain - not avail via admin
        if path.startswith('/docs/'):
            request.META['HTTP_HOST'] = '%s.%s' % (app_id, settings.DEFAULT_DOMAIN)
        else:
            request.META['HTTP_HOST'] = 'admin.%s.%s' % (app_id, settings.DEFAULT_DOMAIN)
        request.META['PATH_INFO'] = path
        request.path_info = path
        request.path = request.META['SCRIPT_NAME'] + path
