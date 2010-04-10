from google.appengine.ext import db

from django.conf import settings

from utils.mixins import Cacheable, Dated


class KeyValue(Cacheable, Dated):
    """
    Key-value store for PageForest documents and resources.
    Entity key name format: app_id/doc_id/key/with/slashes
    """
    value = db.BlobProperty()
    ip = db.StringProperty()  # Last modified from this IPv4 address.

    def get_absolute_url(self):
        app_id, key = self.key().name().split('/', 1)
        return 'http://%s.%s/%s' % (app_id, settings.DEFAULT_DOMAIN, key)
