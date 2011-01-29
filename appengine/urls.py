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
    (r'^chunks/', include('chunks.urls')),
    (r'^backups/', include('backups.urls')),
    (r'^dashboard/', include('dashboard.urls')),

    # Auth uses top-level URLs like /sign-in/ and /email-verify/.
    (r'', include('auth.urls')),
    (r'^auth/', include('auth.appurls')),

    # Pageforest applications on subdomains.
    # TODO: shouldn't these be prefixed to not conflict
    # with application file paths?
    (r'^app/(admin/)?auth/', include('auth.appurls')),
    (r'^app/(admin/)?post/$', 'blobs.views.upload_form'),
    (r'^app/(admin/)?channel/$', 'utils.channel.get_channel'),
    (r'^app/(admin/)?channel/subscriptions/$', 'utils.channel.subscriptions'),
    (r'^app/docs/', include('docs.appurls')),
    (r'^app/mirror/$', 'apps.views.app_list'),

    # Application keyspace reserved for future use
    (r'^app/(docs|data)/', 'utils.views.reserved_url'),

    # Static hosting for Pageforest apps.
    (r'^app/admin/app.json/$', 'apps.views.app_json'),
    # Static app blob resources (files) - docid will be empty
    (r'^app/(admin/)?(?P<doc_id>)(?P<key>.*)$',
     'blobs.views.dispatch'),

    # Simulate different API proxy errors.
    (r'^errors/capability-disabled/$', 'utils.views.capability_disabled'),
    (r'^errors/over-quota/$', 'utils.views.over_quota'),
    (r'^errors/apiproxy-error/$', 'utils.views.apiproxy_error'),
)
