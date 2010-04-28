from google.appengine.ext import db

from utils.mixins import Migratable, Cacheable
from utils import crypto


class User(db.Expando, Migratable, Cacheable):
    """
    The entity key name is username.lower() for case-insensitive matching.
    The password is hmac_sha1(key=raw_password, message=username.lower()).
    """
    username = db.StringProperty()  # May include capital letters.
    email = db.EmailProperty()
    password = db.StringProperty()
    last_login = db.DateTimeProperty(auto_now_add=True)
    date_joined = db.DateTimeProperty(auto_now_add=True)

    def __unicode__(self):
        return self.username

    def set_password(self, password):
        """
        Generate HMAC of the username, using the password as secret key.
        This is similar to hashing the password with salt=username.
        """
        self.password = crypto.hmac_sha1(self.username.lower(), password)

    def migrate(self, next_schema):
        """
        Migrate from one model schema to the next.
        """
        pass
