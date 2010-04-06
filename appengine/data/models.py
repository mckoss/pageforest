from google.appengine.ext import db


class KeyValue(db.Model):
    """
    Object model for the key-value store.
    The entity key name is the canonical absolute URL.
    """
    value = db.BlobProperty()
    namespace = db.StringProperty()
    ip = db.StringProperty()
    timestamp = db.DateTimeProperty()

    def get_absolute_url(self):
        return self.key().name()
