from django.conf.urls.defaults import patterns
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('auth.views',
    # User interface
    (r'^register$', 'register'),
    (r'^validate$', 'validate'),  # AJAX validator for user registration.
    (r'^sign-in/(.+)$', 'sign_in'),  # With token.
    (r'^welcome$', 'welcome', direct_to_template,
     {'template': 'welcome.html'}),
    (r'^sign-out$', 'sign_out'),
    # Auth API for http://app_id.pageforest.com/auth
    (r'^reauth$', 'reauth'),
    (r'^challenge$', 'challenge'),
    (r'^verify/(.+)$', 'verify'),
    (r'^poll/(.+)$', 'poll'),  # With token.
)
