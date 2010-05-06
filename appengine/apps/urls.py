from django.conf import settings
from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns(
    'apps.views',
    (r'^(?P<app_id>%s)/$' % settings.APP_ID_REGEX, 'create_app'),
    (r'^(?P<app_id>%s)/app.json$' % settings.APP_ID_REGEX, 'app_json'),
)
