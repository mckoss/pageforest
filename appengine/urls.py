from django.conf.urls.defaults import patterns, handler404, handler500, include
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('',
    (r'^$', direct_to_template, {'template': 'home.html'}),
    (r'^about$', direct_to_template, {'template': 'about.html'}),
    (r'^auth/', include('auth.urls')),
    (r'^demo/', include('demo.urls')),
    (r'^dashboard/', include('dashboard.urls')),
    (r'^([a-z0-9/\._-]*)$', 'data.views.key_value'),
)
