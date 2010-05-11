from django.conf import settings
from django.conf.urls.defaults import patterns

urlpatterns = patterns('',
    (r'^(?P<doc_id>%s)/$' % settings.DOC_ID_REGEX, 'docs.views.document'),
    (r'^(?P<doc_id>%s)/(?P<key>.+)$' % settings.DOC_ID_REGEX,
     'blobs.views.blob'),
)
