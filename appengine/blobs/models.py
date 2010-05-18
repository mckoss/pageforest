from hashlib import sha1

from google.appengine.ext import db

from django.conf import settings
from django.utils import simplejson as json

from utils.mixins import Timestamped, Migratable, Cacheable


class Blob(Timestamped, Migratable, Cacheable):
    """
    Key-value store for PageForest documents and resources.

    Entity key name format: app_id/doc_id/key/with/slashes/
    The directory in this case: app_id/doc_id/key/with/

    The sha1, valid_json and directory properties are automatically
    updated before datastore put.
    """
    value = db.BlobProperty()
    sha1 = db.StringProperty(indexed=False)
    valid_json = db.BooleanProperty(indexed=False)
    directory = db.StringProperty()

    def get_absolute_url(self):
        """
        The URL includes the default domain name for this app.
        """
        app_id, key = self.key().name().split('/', 1)
        return ''.join(('http://', app_id, '.', settings.DEFAULT_DOMAIN,
                        '/docs/', key))

    @classmethod
    def lookup(cls, key_name):
        """Make lookup an alias for get_by_key_name."""
        return cls.get_by_key_name(key_name)

    def put(self):
        """
        Update sha1 and valid_json properties automatically before
        each datastore put.
        """
        key_parts = self.key().name().rstrip('/').split('/')
        self.directory = '/'.join(key_parts[:-1]) + '/'
        self.sha1 = sha1(self.value).hexdigest()
        self.valid_json = True
        try:
            json.loads(self.value)
        except ValueError:
            self.valid_json = False
        super(Blob, self).put()

    def get_etag(self):
        return '"%s"' % self.sha1
