from django.conf.urls.defaults import *

urlpatterns = patterns('demo.views',
    (r'^$', 'index'),
    (r'^data/$', 'data'),
    (r'^jsonp/$', 'jsonp'),
)
