from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns(
    'chunks.views',
    (r'^cron/vacuum/([0-9a-fA-F]*)/?$', 'vacuum'),
)
