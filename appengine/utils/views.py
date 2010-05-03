from django.conf import settings
from django.http import HttpResponseNotFound


def reserved(request):
    return HttpResponseNotFound(
        "This url is reserved for future use of %s." %
        settings.SITE_NAME)
