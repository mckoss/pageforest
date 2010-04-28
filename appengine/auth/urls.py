from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns('auth.views',
    # User interface
    (r'^register$', 'register'),
    (r'^sign-in$', 'sign_in'),
    (r'^sign-out$', 'sign_out'),
    # Auth API for http://app_id.pageforest.com/auth
    (r'^reauth$', 'reauth'),
    (r'^sign-in/(.+)$', 'sign_in'),  # With token.
    (r'^poll/(.+)$', 'poll'),  # With token.
)
