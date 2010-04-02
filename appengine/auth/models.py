from datetime import datetime

from django.contrib.auth import get_hexdigest, check_password

from google.appengine.ext import db

# from utils.mixins import Migratable

"""
Simplified port of django.contrib.auth.models.User to App Engine.
"""


class User(db.Expando):
    """
    The username is stored in the entity key name.
    """
    email = db.EmailProperty()
    password = db.StringProperty()  # algo$salt$hexdigest
    last_login = db.DateTimeProperty()
    date_joined = db.DateTimeProperty()

    def __unicode__(self):
        return self.username

    def set_password(self, raw_password):
        import random
        algo = 'sha1'
        salt = get_hexdigest(
            algo, str(random.random()), str(random.random()))[:5]
        hsh = get_hexdigest(algo, salt, raw_password)
        self.password = '%s$%s$%s' % (algo, salt, hsh)

    def check_password(self, raw_password):
        """
        Returns a boolean of whether the raw_password was correct.
        Handles encryption formats behind the scenes.
        """
        return check_password(raw_password, self.password)
