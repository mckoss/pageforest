from hashlib import sha1

from google.appengine.ext import db

from django.conf import settings
from django.utils import simplejson as json

from utils.mixins import Timestamped, Migratable, Taggable, Cacheable
from utils.mime import guess_mimetype
from utils.json import is_valid_json


class Blob(Timestamped, Migratable, Taggable, Cacheable):
    """
    Key-value store for PageForest documents and resources.

    Entity key name format: app_id/doc_id/key/with/slashes/
    The directory in this case: app_id/doc_id/key/with/

    The size, sha1, valid_json and directory properties are
    automatically updated before datastore put.
    """
    value = db.BlobProperty()
    size = db.IntegerProperty()
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

    def get_etag(self):
        """Return ETag for use in the HTTP header."""
        return '"%s"' % self.sha1

    def to_backup(self):
        """
        Return file contents for zipfile backup. Modification time is
        stored in zipinfo, other properties will be restored by put.
        """
        return self.value

    def clone(self, key_name):
        """
        Return a copy of this blob with a new key name.

        Mixin properties like schema and modified are not cloned,
        they will be set automatically for the new entity.
        """
        return Blob(
            key_name=key_name,
            value=self.value,
            sha1=self.sha1,
            valid_json=self.valid_json,
            directory=self.directory)

    def put(self):
        """
        Update size, sha1, valid_json and directory properties
        automatically before each datastore put.
        """
        key_parts = self.key().name().rstrip('/').split('/')
        self.directory = '/'.join(key_parts[:-1]) + '/'
        self.size = len(self.value)
        self.sha1 = sha1(self.value).hexdigest()
        # Attempt to parse JSON unless the file extension indicates a
        # well-known MIME type that doesn't allow JSON data.
        mimetype = guess_mimetype(key_parts[-1])
        if mimetype.startswith('image/') or mimetype in [
            'text/html', 'text/css', 'application/pdf']:
            self.valid_json = False
        else:
            self.valid_json = is_valid_json(self.value)
        super(Blob, self).put()
