from django.conf.urls.defaults import patterns

urlpatterns = patterns(
    'auth.views',
    # Auth API for both:
    # - http://www.pageforest.com/auth
    # - http://app_id.pageforest.com/auth
    (r'^reauth/$', 'reauth'),
    (r'^challenge/$', 'challenge'),
    (r'^verify/(.+)/$', 'verify'),
    (r'^username/$', 'get_username'),
    (r'^set-session/(.+)/$', 'set_session_cookie'),
    (r'^get-session/$', 'get_session_cookie'),
)
