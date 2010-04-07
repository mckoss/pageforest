from google.appengine.ext import db

from django.conf import settings


class KeyValue(db.Model):
    """
    Key-value store for PageForest documents and resources.
    Entity key name format: app_id/doc_id/key/with/slashes
    """
    value = db.BlobProperty()
    app_id = db.StringProperty()
    created = db.DateTimeProperty(auto_now_add=True)
    modified = db.DateTimeProperty(auto_now=True)
    ip = db.StringProperty()  # Last modified from this IPv4 address.

    def get_absolute_url(self):
        app_id, key = self.key().name().split('/', 1)
        return 'http://%s.%s/%s' % (app_id, settings.DEFAULT_DOMAIN, key)
