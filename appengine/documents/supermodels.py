from google.appengine.ext import db

from utils.mixins import Cacheable, Migratable, Timestamped


class SuperDoc(Cacheable, Migratable, Timestamped):
    """
    Parent class for App and Doc with shared functionality.

    The first entry in the writers property is the document owner.
    The readers and writers may include the following virtual usernames:
    * anybody = with or without a valid session key
    * authenticated = only users with a valid session key
    """
    title = db.StringProperty()        # Full unicode.
    tags = db.StringListProperty()     # Full unicode short labels.
    writers = db.StringListProperty()  # Usernames that have write access.
    readers = db.StringListProperty()  # Usernames that have read access.

    def is_readable(self, user=None):
        """
        Does this user have read permissions on this document?
        """
        if 'anybody' in self.readers:
            return True
        if 'authenticated' in self.readers and user:
            return True
        if user is None:
            return False
        return user.username.lower() in self.readers

    def is_writable(self, user=None):
        """
        Does this user have write permissions on this document?
        """
        if 'anybody' in self.writers:
            return True
        if 'authenticated' in self.writers and user:
            return True
        if user is None:
            return False
        return user.username.lower() in self.writers
