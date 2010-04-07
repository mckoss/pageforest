from google.appengine.ext import db


class KeyValue(db.Model):
    """
    Object model for the key-value store.
    The entity key name is the canonical absolute URL.
    """
    value = db.BlobProperty()
    namespace = db.StringProperty()
    created = db.DateTimeProperty(auto_now_add=True)
    modified = db.DateTimeProperty(auto_now=True)
    ip = db.StringProperty()  # Last modified from this IPv4 address.

    def get_absolute_url(self):
        return self.key().name()
