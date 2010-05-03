from django.conf.urls.defaults import patterns, handler404, handler500, include
from django.views.generic.simple import direct_to_template

urlpatterns = patterns(
    '',

    # Static pages.
    (r'^$', direct_to_template, {'template': 'home.html'}),
    (r'^about/$', direct_to_template, {'template': 'about.html'}),
    (r'^terms-of-service/$', direct_to_template, {'template': 'tos.html'}),

    # Include separate urls.py for Django apps.
    (r'^auth/', include('auth.urls')),
    (r'^auth/', include('auth.urlsapp')),
    (r'^dashboard/', include('dashboard.urls')),

    # Pageforest applications on subdomains.
    (r'^app/auth/', include('auth.urlsapp')),

    # REVIEW: Don't repeat settings.DOC_ID_RE here (DRY).
    (r'^app/docs/(?P<doc_id>[A-Za-z0-9\._-]+)/$', 'documents.views.document'),
    (r'^app/docs/(?P<doc_id>[A-Za-z0-9\._-]+)/(?P<key>.+)$',
     'storage.views.key_value'),

    # Application keyspace reserved for future use
    (r'^app/(docs|data)/', 'utils.views.reserved'),

    # Static hosting for Pageforest apps.
    (r'^app/app.json$', 'apps.views.app_json'),
    (r'^app/(?P<doc_id>)(?P<key>[A-Za-z0-9\._/-]*)',
     'storage.views.key_value'),
)
