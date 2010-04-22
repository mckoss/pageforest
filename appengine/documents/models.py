from google.appengine.ext import db

from apps.models import App

from utils.mixins import Cacheable, Migratable, Timestamped


class Document(Cacheable, Migratable, Timestamped):
    """
    Metadata for each PageForest document (saved application state).
    Entity key name format: app_id/doc_id (all lower case).

    The first entry in the writers property is the document owner.
    The readers and writers may include the following virtual usernames:
    * friends = friends of the document owner
    * family = family of the document owner
    * authenticated = only users with a valid session key
    * everybody = with or without a valid session key
    """
    app_id = db.StringProperty()       # Lowercase, no dots.
    doc_id = db.StringProperty()       # May contain uppercase letters.
    title = db.StringProperty()        # Full unicode.
    tags = db.StringListProperty()     # Full unicode short labels.
    writers = db.StringListProperty()  # Usernames that have write access.
    readers = db.StringListProperty()  # Usernames that have read access.

    def get_absolute_url(self):
        """Get the absolute URL for this model instance."""
        app = App.get_by_key_name(self.app_id)
        return '/'.join(('http:/', app.domains[0], self.doc_id))
