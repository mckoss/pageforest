from django.conf import settings
from django.http import HttpResponseNotFound


def reserved_url(request):
    """Return 404 Not Found with explanation."""
    return HttpResponseNotFound(
        "This url is reserved for internal use of %s." %
        settings.SITE_NAME)
