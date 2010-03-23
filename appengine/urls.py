from django.conf.urls.defaults import *
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('',
    (r'^$', direct_to_template, {'template': 'home.html'}),
    (r'^auth/', include('auth.urls')),
    (r'^data/', include('data.urls')),
    (r'^demo/', include('demo.urls')),
    (r'^dashboard/', include('dashboard.urls')),
)
