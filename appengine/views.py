import logging

from django.conf import settings
from django.http import HttpResponse, HttpResponseNotFound


@method_required('GET')
def reserved(request):
    return HttpResponseNotFound("This url reserved for future use of %s." %
                                settings.SITE_NAME)
