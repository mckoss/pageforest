from django.conf import settings
from django.utils import simplejson as json

from google.appengine.ext import db

from docs.supermodels import SuperDoc
import blobs.models


class Doc(SuperDoc):
    """
    Metadata for each PageForest document (saved application state).
    Entity key name format: app_id/doc_id (all lower case).
    """
    doc_id = db.StringProperty()  # May contain uppercase letters.

    current_schema = SuperDoc.current_schema + 3

    def blob_key_prefix(self):
        """
        Blob keys are 'appid/docid/...'
        """
        return self.key().name()

    def get_etag(self):
        """Return ETag for use in the HTTP header."""
        return '"%s"' % self.sha1

    def get_absolute_url(self, app=None):
        """
        Get the absolute URL for this model instance.

        Note: This was causing errors in ciruclar references between
        apps and docs.  I'm passing in the app as a parameter
        now to eliminate the circular import.  Is there a better way?
        """
        app_id = self.key().name().split('/')[0]
        # app = App.get_by_key_name(app_id)
        # REVIEW: Why do we have this fallback.  Note that DEFAULT_DOMAIN
        # is not correct for the localhost case.
        if app is None:
            return 'http://%s.%s/#%s' % (
                app_id, settings.DEFAULT_DOMAIN, self.doc_id)
        return app.url + '#' + self.doc_id

    @classmethod
    def create(cls, app_id, doc_id, user):
        """
        Create a new document.
        """
        key_name = '/'.join((app_id, doc_id)).lower()
        username = user.get_username()
        title = doc_id and doc_id[0].upper() + doc_id[1:] or ''
        return Doc(key_name=key_name, doc_id=doc_id,
                   title=title, owner=username)

    def to_json(self, exclude=None):
        """
        Standard json formatted string for the document.
        """
        if exclude is None:
            exclude = ()
        exclude += settings.HIDDEN_PROPERTIES
        blob = blobs.models.Blob.get_by_key_name(self.blob_key_prefix() + '/')
        extra = blob and {"blob": json.loads(blob.value)} or {}
        result = super(Doc, self).to_json(exclude=exclude, extra=extra)
        return result
