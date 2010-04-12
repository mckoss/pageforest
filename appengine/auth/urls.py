from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns('auth.views',
    (r'^register/$', 'register'),
    (r'^login/$', 'login'),
    (r'^logout/$', 'logout'),
)
