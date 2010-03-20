from django.conf.urls.defaults import *

urlpatterns = patterns('data.views',
    (r'^$', 'index'),
    (r'^demo/$', 'demo'),
    (r'^([a-z0-9_,./-]+)$', 'key_value'),
)
