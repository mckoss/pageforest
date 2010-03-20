from django.conf.urls.defaults import *
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('data.views',
    (r'^$', 'index'),
    (r'^demo/$', 'demo'),
    (r'^([a-z0-9_,./-]+)$', 'key_value'),
)
