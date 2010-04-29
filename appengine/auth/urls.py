from django.conf.urls.defaults import patterns
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('auth.views',
    # User interface
    (r'^sign-up$', 'register'),
    # AJAX validator for user registration.
    (r'^welcome$', direct_to_template,
        {'template': 'auth/welcome.html'}),

    # Optional token.
    (r'^sign-in$', 'sign_in'),
    (r'^sign-out$', 'sign_out'),

    # Auth API for http://app_id.pageforest.com/auth
    (r'^reauth$', 'reauth'),
    (r'^challenge$', 'challenge'),
    (r'^verify/(.+)$', 'verify'),
    (r'^poll/(.+)$', 'poll'),  # With token.
)
