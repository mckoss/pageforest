from django.conf import settings
from django.conf.urls.defaults import patterns, handler404, handler500
from django.views.generic.simple import direct_to_template

urlpatterns = patterns(
    'auth.views',
    (r'^sign-up/$', 'sign_up'),
    (r'^sign-in/$', 'sign_in'),
    (r'^account(/(?P<username>%s))?/$' % settings.USERNAME_REGEX, 'account'),
    (r'^sign-in/(?P<app_id>[^/]+)/$', 'sign_in'),
    (r'^get-session-key/(?P<app_id>[^/]+)/$', 'get_app_session_key'),
    (r'^sign-out/$', 'sign_out'),
    (r'^sign-out/(?P<app_id>[^/]+)/$', 'sign_out'),
    (r'^email-verify/(?P<verification>.+)/$', 'email_verification'),
    (r'^email-verify/$', 'email_verification'),
)
