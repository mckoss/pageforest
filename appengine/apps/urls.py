from django.conf import settings
from django.conf.urls.defaults import patterns

urlpatterns = patterns(
    '',

    (r'^(?P<app_id>%s)/$' % settings.APP_ID_REGEX, 'apps.views.create_app'),
)
