from google.appengine.ext import db

from django.conf import settings

from utils.mixins import Timestamped, Migratable, Taggable, Cacheable
from utils.json import assert_boolean, assert_string, assert_string_list


class SuperDoc(Timestamped, Migratable, Taggable, Cacheable):
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

    current_schema = 2

    def migrate(self):
        if self.schema < 2:
            self.deleted = False

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
