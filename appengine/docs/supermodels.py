from google.appengine.ext import db

from utils.mixins import Cacheable, Migratable, Timestamped


class SuperDoc(Timestamped, Migratable, Cacheable):
    """
    Parent class for App and Doc with shared functionality.

    The owner always has read and write permissions, so he does not
    need to be added to the readers and writers lists.

    The readers and writers may include the following virtual usernames:
    * public = with or without a valid session key
    * authenticated = only users with a valid session key
    """
    title = db.StringProperty()        # Full unicode.
    tags = db.StringListProperty()     # Full unicode short labels.
    owner = db.StringProperty()        # Lowercase username of the creator.
    writers = db.StringListProperty()  # Usernames that have write access.
    readers = db.StringListProperty()  # Usernames that have read access.

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
        return username == self.owner or username in self.readers

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
        return username == self.owner or username in self.writers
