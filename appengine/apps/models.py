from google.appengine.ext import db


class App(db.Model):
    """
    The name string is stored in the entity key name.
    """
    domains = db.StringListProperty()  # List of domain names (FQDN).
    developers = db.StringListProperty()  # List of usernames (see auth.User).
    created = db.DateTimeProperty()
    modified = db.DateTimeProperty()
