from google.appengine.ext import db

from apps.models import App


class KeyValue(db.Model):
    """
    The key string is stored in value.key().name().
    """
    app = db.ReferenceProperty(App)
    value = db.TextProperty()
    ip = db.StringProperty()
    created = db.DateTimeProperty()
    modified = db.DateTimeProperty()

    def get_absolute_url(self):
        return '/data/' + self.key().name()
