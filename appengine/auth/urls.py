from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns('auth.views',
    # User interface
    (r'^register$', 'register'),
    (r'^validate$', 'validate'),  # AJAX validator for user registration.
    (r'^sign-in/(.+)$', 'sign_in'),  # With token.
    (r'^sign-out$', 'sign_out'),
    # Auth API for http://app_id.pageforest.com/auth
    (r'^reauth$', 'reauth'),
    (r'^challenge$', 'challenge'),
    (r'^verify/(.+)$', 'verify'),
    (r'^poll/(.+)$', 'poll'),  # With token.
)
