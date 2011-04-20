from django.conf.urls.defaults import patterns

urlpatterns = patterns(
    'auth.views',
    # Auth API for both:
    # - http://www.pageforest.com/auth
    # - http://app_id.pageforest.com/auth
    (r'^challenge/$', 'challenge'),
    (r'^verify/(.+)/$', 'verify'),
    (r'^username/$', 'get_username'),
    (r'^set-session/(.+)/$', 'set_session_cookie'),
    (r'^sign-up/$', 'app_sign_up'),
    # Disabled obsolete URLs:
    # (r'^reauth/$', 'reauth'),
)
