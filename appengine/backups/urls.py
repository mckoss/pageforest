from django.conf.urls.defaults import patterns, handler404, handler500

urlpatterns = patterns(
    'backups.views',
    (r'^$', 'index'),
    (r'^(\w+-\d+-\d+.zip)/$', 'download'),
    (r'^users/cron/$', 'backup_users'),
    (r'^apps/cron/$', 'backup_apps'),
    (r'^docs/cron/$', 'backup_docs'),
    (r'^blobs/cron/$', 'backup_blobs'),
)
