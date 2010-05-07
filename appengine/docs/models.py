from google.appengine.ext import db

from docs.supermodels import SuperDoc
from apps.models import App


class Doc(SuperDoc):
    """
    Metadata for each PageForest document (saved application state).
    Entity key name format: app_id/doc_id (all lower case).
    """
    doc_id = db.StringProperty()  # May contain uppercase letters.

    def get_absolute_url(self):
        """
        Get the absolute URL for this model instance.
        """
        app_id = self.key().name().split('/')[0]
        app = App.get_by_key_name(app_id)
        return ''.join(('http://', app.domains[0], '/docs/', self.doc_id, '/'))

    @classmethod
    def create(cls, app_id, doc_id, user):
        """
        Create a new document.
        """
        key_name = '/'.join((app_id, doc_id)).lower()
        username = user.username.lower()
        return Doc(key_name=key_name,
                   title=doc_id,
                   readers=[username],
                   writers=[username])
