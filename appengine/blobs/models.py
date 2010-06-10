from hashlib import sha1

from google.appengine.ext import db

from django.conf import settings
from django.utils import simplejson as json

from utils.mixins import Timestamped, Migratable, Taggable, Cacheable
from utils.mime import guess_mimetype
from utils.json import is_valid_json

# Don't attempt json.loads if we already know it's not valid.
CERTAINLY_NOT_JSON = ['text/html', 'text/css', 'application/pdf']

# Small data is stored directly in Blob.value, without separate Chunk.
# This is really small so that we can LIST up to 1000 entities without
# exceeding 1 MB for the datastore result, and because multiple copies
# use redundant storage instead of pointing to the same Chunk.
MAX_INTERNAL_SIZE = 600  # bytes


class Chunk(Cacheable):
    """
    The key name is the SHA-1 hash of the content.
    """
    value = db.BlobProperty()


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

    # Schema version for Migratable mixin:
    current_schema = 2

    def __init__(self, *args, **kwargs):
        super(Blob, self).__init__(*args, **kwargs)
        # Set the directory property from the key name.
        key_name = kwargs.get('key_name')
        if key_name is not None:
            key_parts = key_name.rstrip('/').split('/')
            self.directory = '/'.join(key_parts[:-1]) + '/'
        # Update the metadata properties: size, sha1, valid_json.
        value = kwargs.get('value')
        if value is not None:
            self.__setattr__('value', value)

    def __getattribute__(self, name):
        """
        Get data from self.value or a separate Chunk.
        """
        # print '__getattribute__', name
        result = db.Model.__getattribute__(self, name)
        if name == 'value' and result is None:
            chunk = Chunk.get_by_key_name(self.sha1)
            if chunk is None:
                return None
            return chunk.value
        return result

    def __setattr__(self, name, value):
        """
        When setting blob.value, also update size, sha1 and
        valid_json, and put large value in a separate Chunk.
        """
        # print '__setattr__', name, value
        if name != 'value':
            db.Model.__setattr__(self, name, value)
            return
        self.size = len(value)
        self.sha1 = sha1(value).hexdigest()
        # Attempt to parse JSON, unless the file extension indicates a
        # well-known MIME type that doesn't allow JSON data.
        mimetype = guess_mimetype(self.key().name().rstrip('/'))
        if mimetype in CERTAINLY_NOT_JSON or mimetype.startswith('image/'):
            self.valid_json = False
        else:
            self.valid_json = is_valid_json(value)
        # Store value in a separate Chunk if it's large.
        if self.size > MAX_INTERNAL_SIZE:
            if not Chunk.exists(self.sha1):
                Chunk(key_name=self.sha1, value=value).put()
            db.Model.__setattr__(self, name, None)
        else:
            db.Model.__setattr__(self, name, value)

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
        result = Blob(
            key_name=key_name,
            size=self.size,
            sha1=self.sha1,
            valid_json=self.valid_json)
        # Copy the internal value, but don't load Chunk from datastore.
        result._value = self._value
        return result

    def migrate(self, next_schema):
        """
        Migrate from one model schema to the next.
        """
        if next_schema == 2:
            # Update metadata and store data in separate Chunk if large.
            value = self.__getattribute__('value')
            self.__setattr__('value', value)
