from django.conf.urls.defaults import patterns
from django.views.generic.simple import direct_to_template

urlpatterns = patterns(
    'auth.views',
    (r'^sign-up/$', 'register'),
    (r'^sign-in/(?:(?P<app_id>[^/]*)/)?$', 'sign_in'),
    (r'^sign-out/$', 'sign_out'),
    (r'^welcome/$', direct_to_template, {'template': 'auth/welcome.html'}),
)
