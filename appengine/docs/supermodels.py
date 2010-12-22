import logging

from google.appengine.ext import db

from django.conf import settings

from google.appengine.runtime import DeadlineExceededError

from utils.mixins import Timestamped, Migratable, Taggable, Cacheable, Hashable
from utils.json import assert_boolean, assert_string, assert_string_list

from blobs.models import Blob

PAGING_SIZE = 500


class SuperDoc(Timestamped, Migratable, Taggable, Hashable, Cacheable):
    """
    Parent class for App and Doc with shared functionality.

    The owner always has read and write permissions, so he does not
    need to be added to the readers and writers lists.

    The readers and writers may include the following virtual usernames:
    * public = with or without a valid session key
    * authenticated = only users with a valid session key
    """
    title = db.StringProperty()        # Full unicode.
    owner = db.StringProperty()        # Lowercase username of the creator.
    writers = db.StringListProperty()  # Usernames that have write access.
    readers = db.StringListProperty()  # Usernames that have read access.
    deleted = db.BooleanProperty(default=False)

    current_schema = 200               # Migratable schema should be
                                       # added to SuperDoc.schema

    def migrate(self):
        if self.schema < 100:
            self.deleted = False
        if self.schema < 200:
            self.update_hash()

    def normalize_lists(self):
        """
        Force lowercase for all readers and writers.
        """
        self.readers = [username.lower() for username in self.readers]
        self.writers = [username.lower() for username in self.writers]

    def is_readable(self, user=None):
        """
        Does this user have read permissions on this document?
        """
        if 'public' in self.readers:
            return True
        if user is None:
            return False
        if 'authenticated' in self.readers:
            return True
        username = user.get_username()
        return username == self.owner or \
            username in self.readers or \
            username in settings.SUPER_USERS

    def is_writable(self, user=None):
        """
        Does this user have write permissions on this document?
        """
        if 'public' in self.writers:
            return True
        if user is None:
            return False
        if 'authenticated' in self.writers:
            return True
        username = user.get_username()
        return username == self.owner or \
            username in self.writers or \
            username in settings.SUPER_USERS

    def update_writers(self, writers, **kwargs):
        """
        Update writers for this SuperDoc, make sure that the current
        user is not removing his own write permissions.
        """
        old_writers = self.writers
        self.writers = writers
        user = kwargs.get('user', None)
        if user is None:
            if 'public' in old_writers and 'public' not in self.writers:
                # Don't let anonymous user remove public write access.
                self.writers.append('public')
        else:
            username = user.get_username()
            if (username != self.owner
                and username not in self.writers
                and 'public' not in self.writers
                and 'authenticated' not in self.writers):
                # Don't let authenticated user remove his own write access.
                self.writers.append(username)

    def blob_key_prefix(self):
        """
        Return a key prefix that can be used to find child Blobs.

        The key will be appended with '/' and the unique blob key.
        """
        raise NotImplementedError("Document type does not define a Blob key.")

    def all_blobs(self, keys_only=False):
        """
        Generate a Query object restricted to the child Blobs of
        this Doc or App.

        Note that the Blob 'appid/doc/' - the "internal" Doc Blob is included.

        TODO: Should change schema to include an appid and blobid field - that
        way, we can generate queries with order() properties on something OTHER
        than the key (like -modified).
        """
        key_prefix = self.blob_key_prefix()
        query = Blob.all(keys_only=keys_only)
        query.filter('__key__ >=', db.Key.from_path('Blob', key_prefix + '/'))
        query.filter('__key__ <', db.Key.from_path('Blob', key_prefix + '0'))
        return query

    def delete_blobs(self):
        """
        A document (or app) can contain child blobs.  If it's a small number,
        we try to delete them here.  If not, we mark the doc as deleted and
        will clean up the child blobs in the background (TBD).

        Note that each call to delete_blobs() will attempt to delete more of the
        blobs until it succeeds.

        Returns:
           True - document and all child blobs were successfully deleted,
           False - document just marked as deleted - but children still exist
        """
        query = self.all_blobs(keys_only=True)
        keys = None
        count = 0
        try:
            while True:
                keys = query.fetch(PAGING_SIZE)
                if len(keys) == 0:
                    break
                Blob.delete_keys(keys)
                count += len(keys)
                if len(keys) < PAGING_SIZE:
                    break
                query.with_cursor(query.cursor())
        except DeadlineExceededError:
            logging.info("Deadline Exceeded for %s.delete(%s) - %d confirmed." %
                         (self.kind(), self.key().name(), count))
            return False

        logging.info("Deleted %d child blobs of %s:%s." %
                     (count, self.kind(), self.key().name()))
        return True

    def delete(self):
        """
        Override delete operation - tries to delete all child blobs as well.

        The document will either be marked as deleted or actually deleted if
        all it's child blobs can be deleted before the request deadline is
        exceeded.
        """
        self.deleted = True
        self.put()
        if self.delete_blobs():
            super(SuperDoc, self).delete()

    def update_boolean_property(self, parsed, key, **kwargs):
        # TODO: Merge update_*_property methods into one and detect
        # the property type automatically.
        if key not in parsed:
            return
        value = parsed[key]
        assert_boolean(key, value)
        setattr(self, key, value)

    def update_string_property(self, parsed, key, **kwargs):
        if key not in parsed:
            return
        value = parsed[key]
        assert_string(key, value)
        setattr(self, key, value)

    def update_string_list_property(self, parsed, key, **kwargs):
        if key not in parsed:
            return
        values = parsed[key]
        assert_string_list(key, values)
        # Check if update_key method exists. For example,
        # update_writers contains special logic to prevent user from
        # removing his own write access.
        update_method = getattr(self, 'update_' + key, None)
        if update_method:
            update_method(values, **kwargs)
        else:
            setattr(self, key, values)

    def update_from_json(self, parsed, **kwargs):
        self.update_string_property(parsed, 'title', **kwargs)
        # FIXME: update_tags should be used for tag handling as in blobs
        for key in ('tags', 'readers', 'writers'):
            self.update_string_list_property(parsed, key, **kwargs)
        self.normalize_lists()
        self.update_hash()
