from google.appengine.ext import db

from auth.models import User


class App(db.Model):
    """
    The name string is stored in app.key().name().
    """
    creator = db.ReferenceProperty(User)
    created = db.DateTimeProperty(auto_now_add=True)


class KeyValue(db.Model):
    """
    The key string is stored in value.key().name().
    """
    app = db.ReferenceProperty(App)
    value = db.TextProperty()
    creator_ip = db.StringProperty()
    created = db.DateTimeProperty(auto_now_add=True)
