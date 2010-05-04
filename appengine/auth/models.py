import time

from google.appengine.ext import db
from google.appengine.api import mail, memcache

from django.template.loader import render_to_string
from django.template import RequestContext

from utils.mixins import Migratable, Cacheable, Timestamped
from utils import crypto

import settings

CHALLENGE_EXPIRATION = 60  # Seconds.
CHALLENGE_CACHE_PREFIX = 'CR1~'


class User(db.Expando, Migratable, Cacheable, Timestamped):
    """
    The entity key name is username.lower() for case-insensitive matching.
    The password is hmac_sha1(key=raw_password, message=username.lower()).
    """
    username = db.StringProperty(required=True)  # May include capital letters.
    password = db.StringProperty()
    last_login = db.DateTimeProperty(auto_now_add=True)
    email = db.EmailProperty()
    email_verified = db.DateTimeProperty()

    def __unicode__(self):
        return self.username

    @classmethod
    def lookup(cls, username):
        """
        Prefer this accessor over direct calls to get_by_key_name.
        """
        return cls.get_by_key_name(username.lower())

    def set_password(self, password):
        """
        Generate HMAC of the username, using the password as secret key.
        This is similar to hashing the password with salt=username.
        """
        self.password = crypto.hmac_sha1(self.username.lower(), password)

    def check_password(self, password):
        """
        Returns a boolean of whether the (plaintext) password was correct.
        Handles encryption formats behind the scenes.
        """
        return crypto.hmac_sha1(self.username.lower(),
                                password) == self.password

    def migrate(self, next_schema):
        """
        Migrate from one model schema to the next.
        """
        pass

    def send_email_verification(self, request):
        """
        Send email to this user.
        """
        message = render_to_string('auth/verify-email.txt',
                                   RequestContext(request, {'user': self}))
        mail.send_mail(sender=settings.SITE_EMAIL_FROM,
                       to=self.email,
                       subject=settings.SITE_NAME + " account verification.",
                       body=message)

    @classmethod
    def verify_signature(cls, signature, app, remote_ip):
        """
        Check a challenge signature and return the user. If the
        signature is invalid, raise crypto.SignatureError with
        explanation message.
        """
        parts = signature.split(crypto.SEPARATOR)
        if len(parts) != 6:
            raise crypto.SignatureError("Expected 6 parts.")
        (username, random, expires, ip) = parts[:4]
        # Check the inner challenge first.
        if not crypto.verify(parts[1:5], app.secret):
            raise crypto.SignatureError("Challenge invalid.")
        # Check expiration time.
        expires = int(expires)
        now = int(time.time())
        if expires < now:
            raise crypto.SignatureError("Challenge expired.")
        # Check IP address.
        if ip != remote_ip:
            raise crypto.SignatureError("IP address changed.")
        # Check that the same challenge wasn't used before.
        if memcache.get(CHALLENGE_CACHE_PREFIX + random):
            raise crypto.SignatureError("Already used.")
        # Check that the user exists.
        user = cls.get_by_key_name(username.lower())
        if user is None:
            raise crypto.SignatureError("Unknown user.")
        # Check the user's password.
        if not crypto.verify(parts[1:], user.password):
            raise crypto.SignatureError("Password incorrect.")
        # Mark the challenge as used until it expires.
        memcache.set(CHALLENGE_CACHE_PREFIX + random, 'used',
                     time=expires - now + 10)
        return user

    def generate_session_key(self, app, seconds=None):
        """
        Generate a signed session key for this user and app.

            app_id/user/expires/HMAC(user_password, app_secret)

        This routine can generate a reauth cookie by passing in
        seconds=settings.REAUTH_COOKIE_AGE.

        We use the user.password in the key, so when a user changes his
        password, all of his existing session keys are invalidated.
        """
        seconds = seconds or settings.SESSION_COOKIE_AGE
        expires = int(time.time() + seconds)
        secret = crypto.join(self.password, app.secret)
        return crypto.sign(
            app.get_app_id(), self.username.lower(), expires, secret)

    @classmethod
    def verify_session_key(cls, session_key, app):
        """
        Verify the session key and return the user object. If the
        session key is invalid, raise SignatureError with explanation.
        """
        parts = session_key.split(crypto.SEPARATOR)
        if len(parts) != 4:
            raise crypto.SignatureError("Expected 4 parts.")
        (app_id, username, expires, hmac) = parts
        # Check that the session key is for the same app.
        if app_id != app.get_app_id():
            raise crypto.SignatureError("Different app.")
        # Check expiration time.
        expires = int(expires)
        now = int(time.time())
        if expires < now:
            raise crypto.SignatureError("Session key expired.")
        # Check if the user exists.
        user = cls.lookup(username)
        if user is None:
            raise crypto.SignatureError("Unknown user.")
        # Check the user's password and app secret.
        secret = crypto.join(user.password, app.secret)
        if not crypto.verify(session_key, secret):
            raise crypto.SignatureError("Password incorrect.")
        return user
