from django.conf import settings
from django.utils import simplejson as json

from google.appengine.ext import db

from docs.supermodels import SuperDoc
import blobs.models
import apps.models


class Doc(SuperDoc):
    """
    Metadata for each PageForest document (saved application state).
    Entity key name format: app_id/doc_id (all lower case).
    """
    doc_id = db.StringProperty()  # May contain uppercase letters.

    current_schema = SuperDoc.current_schema + 4

    def blob_key_prefix(self):
        """
        Blob keys are 'appid/docid/...'
        """
        return self.key().name()

    def get_etag(self):
        """Return ETag for use in the HTTP header."""
        return '"%s"' % self.sha1

    def get_app(self):
        app_id = self.key().name().split('/')[0]
        return apps.models.App.lookup(app_id)

    def get_absolute_url(self, app=None):
        """
        Get the absolute URL for this model instance.
        """
        return '%s#%s' % (self.get_app().get_app_url(), self.doc_id)

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

    @classmethod
    def json_props(cls):
        props = super(Doc, cls).json_props()
        # We do NOT add doc_id to that hash starting version 4
        return props

    def to_json(self, exclude=None):
        """
        Standard json formatted string for the document.
        """
        blob = blobs.models.Blob.get_by_key_name(self.blob_key_prefix() + '/')
        extra = blob and {"blob": json.loads(blob.value)} or {}
        return super(Doc, self).to_json(exclude=exclude, extra=extra)
