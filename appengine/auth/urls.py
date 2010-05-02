from django.conf.urls.defaults import patterns
from django.views.generic.simple import direct_to_template

urlpatterns = patterns(
    'auth.views',
    # User interface
    (r'^sign-up/$', 'register'),
    (r'^sign-in/(?:(?P<app_id>[^/]*)/)?$', 'sign_in'),
    (r'^sign-out/$', 'sign_out'),
    (r'^welcome/$', direct_to_template, {'template': 'auth/welcome.html'}),

    # Auth API for http://app_id.pageforest.com/auth
    (r'^reauth/$', 'reauth'),
    (r'^challenge/$', 'challenge'),
    (r'^verify/(.+)/$', 'verify'),
    (r'^username/$', 'get_username'),
    # With token.
    (r'^poll/(.+)/$', 'poll'),
)
