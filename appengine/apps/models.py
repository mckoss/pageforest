import re
import time
import logging

from google.appengine.ext import db
from google.appengine.api import memcache

from django.conf import settings

from utils.mixins import Cacheable, Migratable, Timestamped
from utils import crypto

from auth.models import User

CACHE_PREFIX = 'GBH1~'

# 2010-04-29.latest.pageforest.appspot.com
STAGING_DOMAIN_REGEX = '([^\.]+)\.latest\.pageforest\.appspot\.com$'
STAGING_DOMAIN_MATCH = re.compile(STAGING_DOMAIN_REGEX).match

# myapp.2010-04-29.latest.pageforest.appspot.com
APP_STAGING_DOMAIN_REGEX = '(%s)\.%s' % (
    settings.APP_ID_REGEX, STAGING_DOMAIN_REGEX)
APP_STAGING_DOMAIN_MATCH = re.compile(APP_STAGING_DOMAIN_REGEX).match


class App(Cacheable, Migratable, Timestamped):
    """
    The entity key name contains the app_id string,
    minimum length is 2 characters.

    The first entry in domains is the default domain.
    The first entry in developers is the owner.
    """
    title = db.StringProperty()            # Full unicode.
    domains = db.StringListProperty()      # One or more lowercase FQDN.
    writers = db.StringListProperty()      # One or more usernames.
    readers = db.StringListProperty()      # One or more usernames.
    secret = db.BlobProperty()             # Pseudo-random Base64 string.

    @classmethod
    def get_by_hostname(cls, hostname):
        """
        Find the app that serves a given domain. The matching is case
        insensitive and ignores ports like :8080. Results are stored
        in memcache for future requests.

        If the app does not exist, an (in-memory) one will be created
        (but not saved to storage).
        """
        # Check for cached hostname
        app_id = cls.app_id_from_hostname(hostname)
        hostname = app_id + '.' + settings.DEFAULT_DOMAIN
        memcache_key = CACHE_PREFIX + hostname
        cached_app_id = memcache.get(memcache_key)
        if cached_app_id:
            app = cls.lookup(cached_app_id)
            # Make sure hostname is STILL an allowed domain.
            if app and hostname in app.domains:
                return app
            # Remove stale cached entry.
            memcache.delete(memcache_key)

        # Check for hostname in allowed domains list
        app = cls.all().filter('domains', hostname).get()

        if app is None:
            # Get the app directly from datastore (or memcache).
            app = cls.lookup(app_id)

        if app is not None:
            # Store fast hostname lookup in memcache.
            memcache.set(memcache_key, app.app_id())
            return app

    @classmethod
    def app_id_from_hostname(cls, hostname):
        """
        Return app_id (or 'www').  Canonical hostname is then
        app_id.pageforest.com.

        A reference to a naked PF domain is treated as a reference to the
        www.pageforest.com domain with app_id == 'www'.

        >>> App.app_id_from_hostname('app.pageforest.com')
        'app'
        >>> App.app_id_from_hostname('app.pgfrst.com')
        'app'
        >>> App.app_id_from_hostname('localhost')
        'www'
        >>> App.app_id_from_hostname('app.localhost')
        'app'
        >>> App.app_id_from_hostname('pageforest.com')
        'www'
        >>> App.app_id_from_hostname('pageforest.com:8080')
        'www'
        >>> App.app_id_from_hostname('a.random.domain')
        'www'
        >>> App.app_id_from_hostname('pageforest.appspot.com')
        'www'
        >>> App.app_id_from_hostname('latest.pageforest.appspot.com')
        'www'
        >>> App.app_id_from_hostname('dev.latest.pageforest.appspot.com')
        'www'
        >>> App.app_id_from_hostname('app.dev.latest.pageforest.appspot.com')
        'app'
        >>> App.app_id_from_hostname('2010-04.latest.pageforest.appspot.com')
        'www'
        >>> App.app_id_from_hostname('a.2010-04.latest.pageforest.appspot.com')
        'a'
        >>> App.app_id_from_hostname('a.b.dev.latest.pageforest.appspot.com')
        'www'
        """
        # Remove port
        hostname = hostname.lower().split(':')[0]

        # Remove www
        if hostname.startswith('www.'):
            hostname = hostname[4:]

        # Fast exit for normal cases
        if hostname in settings.DOMAINS:
            return 'www'

        # version.latest.pageforest.appspot.com
        if STAGING_DOMAIN_MATCH(hostname):
            return 'www'

        # app.version.latest.pageforest.appspot.com
        match = APP_STAGING_DOMAIN_MATCH(hostname)
        if match:
            return match.group(1)

        # app.pageforest.com, app.pgfr.st, ...
        parts = hostname.split('.', 1)
        if len(parts) == 2 and parts[1] in settings.DOMAINS:
            return parts[0]

        return 'www'

    @classmethod
    def lookup(cls, app_id):
        """
        Lookup App by app_id (key name for model).
        """
        if app_id is None or app_id in settings.RESERVED_APPS:
            return None

        app = cls.get_by_key_name(app_id)
        if app is None and app_id == 'www':
            # First invocation on an empty datastore, create www app.
            app = cls.create('www', settings.DEFAULT_DOMAIN)
            app.put()
        return app

    @classmethod
    def create(cls, app_id, hostname=None):
        """
        All App creation should go through this method.
        """
        if app_id in settings.RESERVED_APPS:
            raise Exception("Application %s is RESERVED." % app_id)
        if hostname is None:
            hostname = app_id + '.' + settings.DEFAULT_DOMAIN
        title = app_id.capitalize()
        # TODO: generate real app secret, check creating user's permissions
        # and quota to do so.
        logging.info("Creating app: %s" % app_id)
        return App(key_name=app_id, title=title, domains=[hostname],
                   secret='SecreT!1')

    # TODO: Rename app_id to get_app_id, maybe?
    def app_id(self):
        """Return the key name which contains the app id."""
        return self.key().name()

    def is_www(self):
        """Is this app the special pafeforest app?"""
        return self.app_id() == 'www'

    def generate_session_key(self, user, seconds=None):
        """
        Generate a signed session key for this app and user.

            app_id/user/expires/HMAC(user_password, app_secret)

        This routine can generate a reauth cookie by passing in
        seconds=settings.REAUTH_COOKIE_AGE.

        We use the user.password in the key, so when a user changes his
        password all of his existing session keys are invalidated.
        """
        seconds = seconds or settings.SESSION_COOKIE_AGE
        expires = time.time() + seconds
        secret = crypto.join(user.password, self.secret)
        return crypto.sign(self.app_id(), user.username.lower(), expires,
                           secret)

    def verify_user(self, key):
        """
        Verify the session key and return the user object.
        If the session key is invalid, return None.
        """
        # TODO: Duplicate most of auth.views.verify.
        (app_id, username, expires, hmac) = key.split(crypto.SEPARATOR)
        user = User.lookup(username)
        if user is None:
            return None
        secret = crypto.join(user.password, self.secret)
        if not crypto.verify(key, secret):
            return None
        return user
