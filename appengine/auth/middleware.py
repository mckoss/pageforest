from urlparse import urlparse

from django.conf import settings
from django.http import HttpResponseForbidden, HttpResponseNotAllowed

from auth import SignatureError
from auth.models import User
from apps.middleware import app_id_from_trusted_domain

READ_METHODS = ('GET', 'HEAD', 'LIST', 'SLICE')


class AccessDenied(HttpResponseForbidden):

    def __init__(self, request, message="Access denied."):
        if hasattr(request, 'referer_error'):
            message += ' ' + request.referer_error
        if hasattr(request, 'session_key_error'):
            message += ' ' + request.session_key_error
        elif request.user is None:
            message += " Please sign in and try again."
        super(AccessDenied, self).__init__(message)


def referer_is_trusted(request):
    """
    Check the referer for this request.
    """
    if 'HTTP_REFERER' not in request.META:
        request.referer_error = "Missing Referer header."
        return False
    referer = request.META['HTTP_REFERER'].strip()
    if not referer:
        request.referer_error = "Empty Referer header."
        return False
    if referer.count('/') < 2:
        request.referer_error = "Invalid Referer header."
        return False
    (scheme, netloc, path, parameters, query, fragment) = urlparse(referer)
    # Remove optional port number.
    hostname = netloc.split(':')[0]
    app_id = app_id_from_trusted_domain(hostname)
    if app_id == 'www':
        # Always trust the www front-end.
        return True
    if app_id == request.app.get_app_id():
        # Don't trust user-generated documents under /docs/.
        if path.startswith('/docs/'):
            request.referer_error = "Untrusted Referer path: " + path
            return False
        # Trust the default domain for this app.
        return True
    for referer in request.app.referers:
        # TODO: Accept https: if trusted_url starts with http:
        if referer.startswith(referer):
            # Explicitly trusted by the app developer.
            return True
    request.referer_error = "Untrusted Referer domain: " + hostname
    return False


def check_permissions(request, resource, method_override=None):
    """
    Check read or write permissions for the current user.
    """
    method = method_override or request.method
    if method in READ_METHODS:
        if 'public' not in resource.readers:
            if not referer_is_trusted(request):
                return AccessDenied(request)
        if not resource.is_readable(request.user):
            return AccessDenied(request, "Read permission denied.")
    else:
        if not referer_is_trusted(request):
            return AccessDenied(request)
        if not resource.is_writable(request.user):
            return AccessDenied(request, "Write permission denied.")


class AuthMiddleware(object):
    """
    Check authentication for each request.
    """

    def process_request(self, request):
        """
        Attempt to extract the user from the session cookie into
        request.user. Then check read or write permissions for the
        current app or document.

        If the session cookie is invalid, request.user is set to None
        and the error message is stored in request.session_key_error.
        The permissions check may still succeed (e.g. for public
        readable documents), but if it fails the stored error message
        is returned with status 403 Forbidden.
        """
        request.user = None
        session_key = None

        # Extract session key from cookie or HTTP header.
        if (settings.SESSION_COOKIE_NAME in request.COOKIES
            and request.subdomain is None
            and (request.app.is_www()
                 or request.path_info.startswith('/app/auth/'))):
            session_key = request.COOKIES[settings.SESSION_COOKIE_NAME]
        else:
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('PFSK1'):
                session_key = auth_header.split()[1]

        # Verify the session key, save error message for later.
        if session_key:
            try:
                request.user = User.verify_session_key(
                    session_key, request.app, request.subdomain)
            except SignatureError, error:
                request.session_key_error = "Invalid %s cookie: %s" % (
                    settings.SESSION_COOKIE_NAME, unicode(error))
                assert request.user is None

        # Allow authentication attempts.
        if (request.path_info == '/app/admin/auth/challenge/'
            or request.path_info.startswith('/app/admin/auth/verify/')):
            return

        # Only allow GET and HEAD for app_id.pageforest.com.
        app_id_methods = ('GET', 'HEAD')
        if (request.subdomain is None and not request.app.is_www()
            and not request.path_info.startswith('/app/docs/')
            and request.method not in app_id_methods):
            return HttpResponseNotAllowed(app_id_methods)

        # Check permissions for the current document.
        if hasattr(request, 'doc'):
            if request.doc is None:
                # Check app read permissions before creating a document.
                assert request.method == 'PUT'
                if request.user is None:
                    return AccessDenied(request, "Write permission denied.")
                # Application readers = document creators.
                return check_permissions(request, request.app, 'GET')
            else:
                # Check permissions for current document or its blob store.
                return check_permissions(request, request.doc)

        # Let authenticated user create an app by uploading app.json.
        if (request.app.owner == ''
            and request.method == 'PUT'
            and request.path_info == '/app/%s/app.json/' %
                settings.ADMIN_SUBDOMAIN
            and request.user is not None):
            return

        # Check permissions for the current app.
        return check_permissions(request, request.app)


def user_context(request):
    """
    Make the logged in user available as {{ user }} in templates.
    """
    if hasattr(request, 'user') and request.user:
        return {'user': request.user}
    return {}
