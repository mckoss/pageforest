from google.appengine.ext import db

from utils.mixins import Cacheable, Dated
from apps.models import App


class KeyValue(Cacheable, Dated):
    """
    Key-value store for PageForest documents and resources.
    Entity key name format: app_id/doc_id/key/with/slashes
    """
    value = db.BlobProperty()
    ip = db.StringProperty()  # Last modified from this IPv4 address.

    def get_absolute_url(self):
        """The URL includes the default domain name for this app."""
        app_id, key = self.key().name().split('/', 1)
        app = App.get_by_key_name(app_id)
        return '/'.join(('http:/', app.domain, key))
