from django.conf.urls.defaults import patterns, handler404, handler500, include
from django.views.generic.simple import direct_to_template

urlpatterns = patterns(
    '',

    # Static pages.
    (r'^$', direct_to_template, {'template': 'home.html'}),
    (r'^about/$', direct_to_template, {'template': 'about.html'}),
    (r'^terms-of-service/$', direct_to_template, {'template': 'tos.html'}),

    # Include separate urls.py for Django apps.
    (r'^apps/', include('apps.urls')),
    (r'^docs/', include('docs.urls')),
    (r'^dashboard/', include('dashboard.urls')),

    # Auth uses top-level URLs like /sign-in/ and /email-verify/.
    (r'', include('auth.urls')),
    (r'^auth/', include('auth.appurls')),

    # Pageforest applications on subdomains.
    (r'^app/auth/', include('auth.appurls')),
    (r'^app/docs/', include('docs.appurls')),

    # Application keyspace reserved for future use
    (r'^app/(docs|data)/', 'utils.views.reserved_url'),

    # Static hosting for Pageforest apps.
    (r'^app/(?P<doc_id>)(?P<key>[A-Za-z0-9\._/-]*)', 'blobs.views.dispatch'),
)
