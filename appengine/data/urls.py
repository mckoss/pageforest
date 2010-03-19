from django.conf.urls.defaults import *
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('',
    (r'^$', 'data.views.index'),
    (r'^test/$', direct_to_template, {'template': 'data/test.html'}),
    (r'^([a-z0-9_,./-]+)$', 'data.views.key_value'),
)
