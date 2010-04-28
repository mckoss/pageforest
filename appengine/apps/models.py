from datetime import datetime, timedelta

from google.appengine.ext import db
from google.appengine.api import memcache

from django.conf import settings

from utils.mixins import Cacheable, Migratable, Timestamped
from utils import crypto


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

        Possible matches are checked in this order:
        * hostname == key_name + '.' + one of settings.DOMAINS
        * hostname in domains
        * create dummy app
        """
        hostname = hostname.lower().split(':')[0]
        # Try get_by_key_name, using Cacheable mixin for memcache.
        key_name = hostname.split('.')[0]
        for domain in settings.DOMAINS:
            if hostname.endswith('.' + domain):
                app = cls.get_by_key_name(key_name)
                if app:
                    return app
        # That didn't work, try hostname lookup in memcache.
        memcache_key = 'GBH~' + hostname
        key_name = memcache.get(memcache_key)
        if key_name is None:  # Try to find app by domain index.
            app = cls.all().filter('domains', hostname).get()
            if app:
                memcache.set(memcache_key, app.key().name())
                return app
        else:  # The key_name was found in memcache, use Cacheable mixin.
            app = cls.get_by_key_name(key_name)
            if app:
                return app
        # No app for this hostname (yet), create a dummy app.
        key_name = hostname.split('.')[0]
        title = key_name.capitalize()
        return App(key_name=key_name, title=title, domains=[hostname],
                   secret='SecreT!1')

    def generate_session_key(self, user, seconds=None):
        """
        Generate a signed session key for this app and user.
        """
        seconds = seconds or settings.SESSION_COOKIE_AGE
        expires = datetime.now() + timedelta(seconds=seconds)
        secret = crypto.join(user.password, self.secret)
        return crypto.sign(self.key().name(), user.username, expires, secret)
