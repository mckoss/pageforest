import logging

from django.conf import settings
from django.http import HttpResponseNotFound

from utils.decorators import method_required

# REVIEW: It seems unclean to have a views.py in the top level.
# Should we move this to appengine.utils or similar?


@method_required('GET')
def reserved(request):
    return HttpResponseNotFound("This url reserved for future use of %s." %
                                settings.SITE_NAME)
