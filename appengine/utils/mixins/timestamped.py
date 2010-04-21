from google.appengine.ext import db


class Timestamped(db.Model):
    """
    Standardized timestamp information for models.
    """
    created = db.DateTimeProperty(auto_now_add=True)
    created_ip = db.StringProperty()
    modified = db.DateTimeProperty(auto_now=True)
    modified_ip = db.StringProperty()
