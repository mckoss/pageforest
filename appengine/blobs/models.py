from hashlib import sha1
import logging

from google.appengine.ext import db

from django.conf import settings
from django.utils import simplejson as json

from utils.mixins import Timestamped, Migratable, Taggable, Cacheable, Hashable
from utils.mime import guess_mimetype
from utils.json import is_valid_json

from chunks.models import Chunk

# Don't attempt json.loads if we already know it's not valid.
CERTAINLY_NOT_JSON = ['text/html', 'text/css', 'application/pdf']

# Small data is stored directly in Blob.value, without separate Chunk.
# This is really small so that we can LIST up to 1000 entities without
# exceeding 1 MB for the datastore result, and because multiple copies
# use redundant storage instead of pointing to the same Chunk.
MAX_INTERNAL_SIZE = 600  # bytes


class Blob(Timestamped, Migratable, Taggable, Hashable, Cacheable):
    """
    Key-value store for PageForest documents and resources.

    Entity key name format: app_id/doc_id/key/with/slashes/
    The directory in this case: app_id/doc_id/key/with/

    The size, sha1, valid_json and directory properties are
    automatically updated before datastore put.
    """
    value = db.BlobProperty()
    valid_json = db.BooleanProperty(indexed=False)
    directory = db.StringProperty()

    # TODO: Add owner - Ownable mixin with security checks?

    # Schema version for Migratable mixin:
    current_schema = 3

    def __init__(self, *args, **kwargs):
        self._in_init = True
        super(Blob, self).__init__(*args, **kwargs)
        self._in_init = False

        # Set the directory property from the key name.
        key_name = kwargs.get('key_name')
        if key_name is not None:
            key_parts = key_name.rstrip('/').split('/')
            self.directory = '/'.join(key_parts[:-1]) + '/'

        # Only update hash if value is given AND the
        # sha1 hasn't been initialized already.
        if 'value' in kwargs and self.sha1 is None:
            self.set_value(kwargs['value'])

    def migrate(self):
        """
        Update entity to the current schema.
        """
        if self.schema < 2:
            # Update metadata and store data in separate Chunk if large.
            value = self.__getattribute__('value')
            self.__setattr__('value', value)
        if self.schema < 3:
            # Datastore put will enable indexing for sha1 property.
            pass

    def __getattribute__(self, name):
        """
        Get data from self.value or a separate Chunk.

        Note that self._value is the actual storage in the
        Blob - whereas self.value mirrors the stored chunk's
        value when allocated.
        """
        result = super(Blob, self).__getattribute__(name)
        if name != 'value':
            return result
        if result is None and self.sha1 is not None:
            chunk = Chunk.get_by_key_name(self.sha1)
            if chunk is None:
                return None
            return chunk.value
        return result

    def set_value(self, value):
        """
        Set value and update all computed properties that are not
        already initialized. We want to defer these when multiple
        properties are set at once in __init__, since some are
        expensive and the value will be restored directly.
        """
        self.update_hash(value)

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
            super(Blob, self).__setattr__('value', None)
        else:
            super(Blob, self).__setattr__('value', value)

    def __setattr__(self, name, value):
        if name == 'value':
            if not self._in_init:
                self.set_value(value)
            return

        super(Blob, self).__setattr__(name, value)

    def get_absolute_url(self):
        """
        The URL includes the default domain name for this app.
        """
        app_id, key = self.key().name().split('/', 1)
        if app_id == 'apps':
            app_id, key = key.split('/', 1)
            key = '/' + key.rstrip('/')
        else:
            key = '/docs/' + key
        domain = app_id + '.' + settings.DEFAULT_DOMAIN
        return 'http://' + domain + key

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
