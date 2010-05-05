from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns(
    'auth.views',
    # User interface
    (r'^register$', 'register'),
    (r'^sign-in$', 'sign_in'),
    (r'^sign-out$', 'sign_out'),

    # API's
    (r'^reauth$', 'reauth'),
    (r'^sign-in$', 'sign_in'),
    (r'^validate$', 'validate'),
    (r'^challenge$', 'challenge'),
    (r'^verify/(.+)$', 'verify'),
    (r'^poll/(.+)$', 'poll'),
)
