import logging

from django.conf import settings
from django.utils import simplejson as json

from google.appengine.ext import db

from docs.supermodels import SuperDoc
import blobs.models
from utils.middleware import RequestMiddleware


class Doc(SuperDoc):
    """
    Metadata for each PageForest document (saved application state).
    Entity key name format: app_id/doc_id (all lower case).
    """
    doc_id = db.StringProperty()  # May contain uppercase letters.

    """
    Versions:
    4 - doc_id not included in hash
    """

    current_schema = SuperDoc.current_schema + 4

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
        if app is None:
            from apps.models import App
            app = App.get_by_key_name(app_id)
        url = app.url
        request = RequestMiddleware.get_request()
        if request:
            hostname = request.META.get('HTTP_HOST', settings.DEFAULT_DOMAIN).replace('www.', '')
            url = url.replace(settings.DEFAULT_DOMAIN, hostname)
        return "%s#%s" % (url, self.doc_id)

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
        props.update({'doc_id': 'docid'})
        return props

    @classmethod
    def nohash_props(cls):
        """
        Don't included docid in the hash for the model.
        """
        props = super(Doc, cls).nohash_props()
        return props + ('doc_id',)

    def to_json(self, exclude=None):
        """
        Standard json formatted string for the document.
        """
        blob = blobs.models.Blob.get_by_key_name(self.blob_key_prefix() + '/')
        extra = blob and {"blob": json.loads(blob.value)} or {}
        return super(Doc, self).to_json(exclude=exclude, extra=extra)
