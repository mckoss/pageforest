import time
import logging
import re

from google.appengine.ext import db
from google.appengine.api import memcache

from utils.mixins import Timestamped, Migratable, Cacheable
from utils import crypto
from utils.shortcuts import dict_from_attrs

from auth import AuthError, SignatureError
from apps.models import App

import settings

CHALLENGE_EXPIRATION = 60  # Seconds.
CHALLENGE_CACHE_PREFIX = 'CR1~'

# From Djano forms.fields
email_match = re.compile(
    r"(^[-!#$%&'*+/=?^_`{}|~0-9A-Z]+(\.[-!#$%&'*+/=?^_`{}|~0-9A-Z]+)*"
    r'|^"([\001-\010\013\014\016-\037!#-\[\]-\177]|\\[\001-011\013\014\016-\177])*"'
    r')@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?$', re.IGNORECASE).match

username_match = re.compile("(%s)|(%s)" %
                            (settings.USERNAME_REGEX, settings.APP_USERNAME_REGEX)).match


class User(db.Expando, Timestamped, Migratable, Cacheable):
    """
    The entity key name is username.lower() for case-insensitive matching.
    The password is hmac_sha1(key=raw_password, message=username.lower()).
    """
    username = db.StringProperty(required=True)  # May include capital letters.
    password = db.StringProperty()
    last_login = db.DateTimeProperty(auto_now_add=True)
    email = db.EmailProperty()
    email_verified = db.DateTimeProperty()
    max_apps = db.IntegerProperty(default=settings.MAX_APPS)
    is_admin = db.BooleanProperty(default=False)

    current_schema = 2

    def migrate(self):
        if self.schema < 2:
            self.max_apps = settings.MAX_APPS
            self.is_admin = False

    def __unicode__(self):
        return self.username

    def validate(self):
        """
        Validate all the values of the model - raise exception on error.
        """
        if not username_match(self.username):
            raise ValueError("Invalid username: '%s'" % self.username)
        if not email_match(self.email):
            raise ValueError("Invalid email address: '%s'" % self.email)
        if len(self.password) != 40:
            raise ValueError("Invalid user secret - should be 40 character hash.")

    def put(self):
        self.validate()
        super(User, self).put()

    @classmethod
    def lookup(cls, username):
        """
        Prefer this accessor over direct calls to get_by_key_name.
        """
        if username is None:
            return None
        return cls.get_by_key_name(username.lower())

    # REVIEW: This is confusing because I would expect to get the
    # username, not the username converted to lowercase. Can we
    # rename this method to user.get_lower() or similar?
    def get_username(self):
        return self.key().name()

    def get_form_dict(self):
        """
        Return a dict that can be used as initial argument for a form.

        Note that we'd ordinarily use ModelForm - but not support for AppEngine
        db.Model's.
        """
        return dict_from_attrs(self, ['username', 'password', 'email', 'max_apps', 'is_admin'])

    def set_password(self, password):
        """
        Generate HMAC of the username, using the password as secret key.
        This is similar to hashing the password with salt=username.
        """
        self.password = crypto.hmac_sha1(self.get_username(), password)

    def check_password(self, password):
        """
        Returns a boolean of whether the (plaintext) password was correct.
        """
        hmac = crypto.hmac_sha1(self.get_username(), password)
        return hmac == self.password

    @classmethod
    def verify_signature(cls, signature, app, remote_ip):
        """
        Check a challenge signature and return the user. If the
        signature is invalid, raise SignatureError with explanation.
        """
        parts = crypto.split(signature)
        if len(parts) != 6:
            raise SignatureError("Expected 6 parts.")
        (username, random, expires, ip) = parts[:4]
        # Check the inner challenge first.
        if not crypto.verify(parts[1:5], app.secret):
            raise SignatureError("Challenge invalid.")
        # Check expiration time.
        expires = int(expires)
        now = int(time.time())
        if expires < now:
            raise SignatureError("Challenge expired.")
        # Check IP address.
        if ip != remote_ip:
            raise SignatureError("IP address changed.")
        # Check that the same challenge wasn't used before.
        if memcache.get(CHALLENGE_CACHE_PREFIX + random):
            raise SignatureError("Already used.")
        # Check that the user exists.
        if not username:
            raise SignatureError("Missing username.")
        user = cls.lookup(username)
        if user is None:
            raise SignatureError("Unknown user.")
        # Check the user's password.
        if not crypto.verify(parts[1:], user.password):
            raise SignatureError("Password incorrect.")
        # Mark the challenge as used until it expires.
        memcache.set(CHALLENGE_CACHE_PREFIX + random, 'used',
                     time=expires - now + 10)
        return user

    def generate_session_key(self, app, subdomain=None, seconds=None):
        """
        Generate a signed session key for this user and app.

        subdomain.app_id/user/expires/HMAC(user_password, app_secret)

        This routine can generate a reauth cookie by passing in
        seconds=settings.REAUTH_COOKIE_AGE.

        We use the user.password in the key, so when a user changes his
        password, all of his existing session keys are invalidated.
        """
        app_id = app.get_app_id()
        if subdomain:
            app_id = subdomain + '.' + app_id
        seconds = seconds or settings.SESSION_COOKIE_AGE
        expires = int(time.time() + seconds)
        secret = crypto.join(self.password, app.secret)
        return crypto.sign(app_id, self.get_username(), expires, secret)

    @classmethod
    def verify_session_key(cls, session_key, app, subdomain=None):
        """
        Verify the session key and return the user object. If the
        session key is invalid, raise SignatureError with explanation.
        """
        parts = crypto.split(session_key)
        if len(parts) != 4:
            raise SignatureError("Expected 4 parts.")
        (subdomain_app_id, username, expires) = parts[:3]
        app_id = subdomain_app_id.split('.')[-1]
        # Check the subdomain.
        if subdomain == 'docs' or not subdomain:
            if '.' in subdomain_app_id:
                raise SignatureError("Unexpected subdomain.")
        else:
            if '.' not in subdomain_app_id:
                raise SignatureError("Missing subdomain.")
            elif subdomain_app_id != '%s.%s' % (subdomain, app_id):
                raise SignatureError("Different subdomain.")
        # Check that the session key is for the same app.
        if app_id != app.get_app_id():
            raise SignatureError("Different app.")
        # Check expiration time.
        expires = int(expires)
        now = int(time.time())
        if expires < now:
            raise SignatureError("Session key expired.")
        # Check if the user exists.
        user = cls.lookup(username)
        if user is None:
            raise SignatureError("Unknown user.")
        # Check the user's password and app secret.
        secret = crypto.join(user.password, app.secret)
        if not crypto.verify(session_key, secret):
            raise SignatureError("Password incorrect.")
        return user

    @classmethod
    def verify_email(self, signature, secret):
        """
        Verify the email signature and return the user object. If the
        signature is invalid, raise SignatureError with explanation.
        """
        # Check the HMAC-SHA1 signature.
        if not crypto.verify(signature, secret):
            raise SignatureError("Invalid verification code.")
        (username, email, expires, secret) = crypto.split(signature)
        # Check expiration time.
        if time.time() > expires:
            raise SignatureError("Expired verification code.")
        # Check if the user exists.
        user = User.lookup(username)
        if user is None:
            raise SignatureError("Unknown user.")
        # Check if the email address is unchanged.
        if user.email != email:
            raise SignatureError("Email address changed.")
        return user

    def assert_authorized(self, action):
        """
        Check if this user is allowed to perform the specified action.
        """
        if self.is_admin:
            return True

        if action == App.create:
            # Each user must complete email verification before creating apps.
            if self.email_verified is None:
                raise AuthError("Please verify your email address.")

            # Make sure they haven't already used their quota.
            results = App.all().filter('owner', self.get_username())
            results = [app for app in results if not app.deleted]
            count = len(results)
            if count >= self.max_apps:
                logging.warning("%s attempted to create more than %d apps." %
                                (self.email, count))
                raise AuthError(
                    "Send email to %s to create more than %d apps." %
                    (settings.SITE_EMAIL_FROM, count))
        return True
