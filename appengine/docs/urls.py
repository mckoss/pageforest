from django.conf.urls.defaults import patterns

urlpatterns = patterns(
    'docs.views',
    (r'^$', 'index'),
)
