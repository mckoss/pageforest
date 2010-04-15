from google.appengine.ext import db

from django.conf import settings
from django.utils import simplejson as json

from apps.models import App


class Document(db.Model):
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
    created = db.DateTimeProperty()
    modified = db.DateTimeProperty()

    def get_absolute_url(self):
        app = App.get_by_key_name(self.app_id)
        return '/'.join(('http:/', app.default_domain, self.doc_id))
