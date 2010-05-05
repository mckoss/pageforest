from django.conf import settings
from django.http import HttpResponseNotFound


def reserved(request):
    """Return 404 Not Found with explanation."""
    return HttpResponseNotFound(
        "This url is reserved for future use of %s." %
        settings.SITE_NAME)
