from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns(
    'chunks.views',
    (r'^([0-9a-f]+)/?$', 'chunk_get'),
    (r'^cron/vacuum/([0-9a-f]*)/?$', 'vacuum'),
)
