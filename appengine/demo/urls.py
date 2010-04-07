from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns('demo.views',
    (r'^$', 'index'),
    (r'^rest/$', 'rest'),
    (r'^jsonp/$', 'jsonp'),
)
