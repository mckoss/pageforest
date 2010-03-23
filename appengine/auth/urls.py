from django.conf.urls.defaults import *

urlpatterns = patterns('auth.views',
    (r'^login/$', 'login'),
    (r'^logout/$', 'logout'),
)
