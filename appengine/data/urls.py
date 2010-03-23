from django.conf.urls.defaults import *

urlpatterns = patterns('data.views',
    (r'^$', 'index'),
    (r'^([a-z0-9_,./-]+)$', 'key_value'),
)
