from django.conf.urls.defaults import patterns, handler404, handler500, include
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('',
    (r'^$', direct_to_template, {'template': 'home.html'}),
    (r'^about$', direct_to_template, {'template': 'about.html'}),
    (r'^auth/', include('auth.urls')),
    (r'^dashboard/', include('dashboard.urls')),
    (r'^([A-Za-z0-9\._-]+)/?$', 'documents.views.document'),
    (r'^([A-Za-z0-9\._-]+)/(.+)$', 'storage.views.key_value'),
)
