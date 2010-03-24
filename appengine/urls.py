from django.conf.urls.defaults import *
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('',
    (r'^auth/', include('auth.urls')),
    (r'^data/', include('data.urls')),
    (r'^demo/', include('demo.urls')),
    (r'^dashboard/', include('dashboard.urls')),
    (r'^$', 'hosting.views.document'),
    (r'^([a-z0-9\._-]+\.html)$', 'hosting.views.document'),
    (r'^([a-z0-9\._-]+\.css)$', 'hosting.views.document',
     {'mimetype': 'text/css'}),
    (r'^([a-z0-9\._-]+\.js)$', 'hosting.views.document',
     {'mimetype': 'text/javascript'}),
)
