from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns('auth.views',
    (r'^register(|/validate)$', 'register'),
    (r'^challenge$', 'challenge'),
    (r'^verify/(.+)$', 'verify'),
    (r'^logout$', 'logout'),
)
