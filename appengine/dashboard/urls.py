from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns('dashboard.views',
    (r'^$', 'dashboard'),
    (r'^cron/(\d+/)?$', 'cron'),
)
