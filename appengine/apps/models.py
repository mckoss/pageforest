from google.appengine.ext import db

from auth.models import User


class App(db.Model):
    """
    The name string is stored in app.key().name().
    """
    ip = db.StringProperty()
    created = db.DateTimeProperty()
    modified = db.DateTimeProperty()


class AppOwner(db.Model):
    """
    Many-to-many relationship between App and User model.
    """
    app = db.ReferenceProperty(App)
    admin = db.ReferenceProperty(User)
    created = db.DateTimeProperty()
