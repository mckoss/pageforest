from google.appengine.ext import db

from utils.mixins import Migratable, Cacheable


# This function was adapted from django.contrib.auth.models
# Copyright (c) Django Software Foundation and individual contributors.
def get_hexdigest(algorithm, salt, raw_password):
    """
    Returns a string of the hexdigest of the given plaintext password
    and salt using the given algorithm ('md5', 'sha1' or 'crypt').
    """
    if algorithm == 'md5':
        from django.utils.hashcompat import md5_constructor
        return md5_constructor(salt + raw_password).hexdigest()
    elif algorithm == 'sha1':
        from django.utils.hashcompat import sha_constructor
        return sha_constructor(salt + raw_password).hexdigest()
    raise ValueError("Got unknown password algorithm type in password.")


# This function was adapted from django.contrib.auth.models
# Copyright (c) Django Software Foundation and individual contributors.
def check_password(raw_password, enc_password):
    """
    Returns a boolean of whether the raw_password was correct. Handles
    encryption formats behind the scenes.
    """
    algo, salt, hsh = enc_password.split('$')
    return hsh == get_hexdigest(algo, salt, raw_password)


class User(db.Expando, Migratable, Cacheable):
    email = db.EmailProperty()
    password = db.StringProperty()  # algo$salt$hexdigest
    last_login = db.DateTimeProperty(auto_now_add=True)
    date_joined = db.DateTimeProperty(auto_now_add=True)

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
