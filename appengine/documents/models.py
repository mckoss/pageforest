from google.appengine.ext import db

from apps.models import App

from utils.mixins import Cacheable, Migratable, Dated


class Document(Cacheable, Migratable, Dated):
    """
    Metadata for each PageForest document (saved application state).
    Entity key name format: app_id/doc_id (all lower case).
    """
    app_id = db.StringProperty()       # Lowercase, no dots.
    doc_id = db.StringProperty()       # May contain uppercase letters.
    title = db.StringProperty()        # Full unicode.
    owner = db.StringProperty()        # Username of the creator.
    readers = db.StringListProperty()  # Usernames that have read access.
    writers = db.StringListProperty()  # Usernames that have write access.
    tags = db.StringListProperty()

    def get_absolute_url(self):
        """Get the absolute URL for this model instance."""
        app = App.get_by_key_name(self.app_id)
        return '/'.join(('http:/', app.domains[0], self.doc_id))
