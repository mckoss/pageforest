from django.conf.urls.defaults import patterns, handler404, handler500, include
from django.views.generic.simple import direct_to_template

urlpatterns = patterns('',
    (r'^$', direct_to_template, {'template': 'home.html'}),
    (r'^about/$', direct_to_template, {'template': 'about.html'}),
    (r'^terms-of-service/$', direct_to_template, {'template': 'tos.html'}),

    # Some Django apps have their own urls.py.
    (r'^auth/', include('auth.urls')),
    (r'^dashboard/', include('dashboard.urls')),

    # Pageforest applications on subdomains.
    (r'^app/auth/', include('auth.urls')),
    (r'^app/docs/([A-Za-z0-9\._-]*)/$', 'documents.views.document'),
    (r'^app/docs/([A-Za-z0-9\._-]+)/(.+)$', 'storage.views.key_value'),

    # Static hosting for Pageforest apps.
    (r'^app/app.json$', 'apps.views.app_json'),
    (r'^app/()([A-Za-z0-9\._/-]*)', 'storage.views.key_value'),
)
