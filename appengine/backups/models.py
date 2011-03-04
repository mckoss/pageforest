from google.appengine.ext import db

from utils.mixins import Migratable, Timestamped


class Backup(Migratable, Timestamped):
    """
    Save recently modified entities from datastore to a zip file.
    """
    model = db.StringProperty()       # Model kind of entities, e.g. User.
    keys = db.StringListProperty()    # All key names in this backup.
    oldest = db.DateTimeProperty()    # When the oldest entity was modified.
    youngest = db.DateTimeProperty()  # When the youngest entity was modified.
    zipfile = db.BlobProperty()       # Binary storage for zip file.
