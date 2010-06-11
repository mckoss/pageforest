from django.conf import settings
from django.http import HttpResponseNotFound

from google.appengine.runtime import apiproxy_errors


def reserved_url(request, *args, **kwargs):
    """Return 404 Not Found with explanation."""
    return HttpResponseNotFound(
        "This url is reserved for internal use of %s." %
        settings.SITE_NAME)


def capability_disabled(request):
    raise apiproxy_errors.CapabilityDisabledError(
        "Datastore writes are currently disabled.")


def over_quota(request):
    raise apiproxy_errors.OverQuotaError(
        "Your email quota is used up for today.")


def apiproxy_error(request):
    raise apiproxy_errors.Error("Some other apiproxy error.")
