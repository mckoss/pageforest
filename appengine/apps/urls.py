from django.conf import settings
from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns(
    'apps.views',
    (r'^$', 'index'),
    (r'^(?P<app_id>%s)/$' % settings.APP_ID_REGEX, 'details'),
    (r'^(?P<app_id>%s)/clone/$' % settings.APP_ID_REGEX, 'clone'),
)
