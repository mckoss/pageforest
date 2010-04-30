from datetime import datetime, timedelta

from google.appengine.ext import db
from google.appengine.api import memcache

from django.conf import settings

from utils.mixins import Cacheable, Migratable, Timestamped
from utils import crypto

CACHE_PREFIX = 'GBH1~'


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
        """
        # Check for cached hostname
        hostname = hostname.lower().split(':')[0]
        memcache_key = CACHE_PREFIX + hostname
        app_id = memcache.get(memcache_key)
        if app_id:
            app = cls.lookup(app_id)
            if app and hostname in app.domains:
                return app
            # Memcache has a bogus hostname key - remove it.
            memcache.delete(memcache_key)

        # Check for hostname in allowed domains list
        app = cls.all().filter('domains', hostname).get()
        if app:
            memcache.set(memcache_key, app.app_id())
            return app

        # Check for app_id.pageforest.com (et. al.)
        dot = hostname.index('.')
        (app_id, dot, sub_domain) = hostname.partition('.')
        if sub_domain in settings.DOMAINS:
            app = cls.lookup(app_id)
            if app:
                memcache.set(memcache_key, app.app_id())
                return app

        # No app for this hostname (yet), create a dummy app.
        # REVIEW: Shouldn't we put app creation in a class function
        # and isolate the permissions and quota rules in one place?
        # Could put access control in overridden put() method.
        # BUG: should not be creating dummy apps here?
        return cls.create(app_id, hostname)

    @classmethod
    def lookup(cls, app_id):
        """
        Lookup App by app_id (key name for model)
        """
        if app_id in settings.RESERVED_APPS:
            return None
        return cls.get_by_key_name(app_id)

    @classmethod
    def create(cls, app_id, hostname=None):
        """
        All App creation should go through this method.
        """
        if app_id in settings.RESERVED_APPS:
            return None
        title = app_id.capitalize()
        # TODO: generate real app secret, check creating user's permissions
        # and quota to do so.
        return App(key_name=app_id, title=title, domains=[hostname],
                   secret='SecreT!1')

    def app_id(self):
        return self.key().name()

    def generate_session_key(self, user, seconds=None):
        """
        Generate a signed session key for this app and user.
        """
        seconds = seconds or settings.SESSION_COOKIE_AGE
        expires = datetime.now() + timedelta(seconds=seconds)
        secret = crypto.join(user.password, self.secret)
        return crypto.sign(self.key().name(), user.username, expires, secret)
