from django.conf.urls.defaults import *

urlpatterns = patterns('demo.views',
    (r'^$', 'index'),
    (r'^rest/$', 'rest'),
    (r'^jsonp/$', 'jsonp'),
)
