from django.conf.urls.defaults import *
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('',
    (r'^auth/', include('auth.urls')),
    (r'^demo/', include('demo.urls')),
    (r'^dashboard/', include('dashboard.urls')),
    (r'^([a-z0-9/\._-]*)$', 'data.views.key_value'),
)
