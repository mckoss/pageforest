import logging

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

        If the app does not exist, an (in-memory) one will be created
        (but not saved to storage).
        """
        # Check for cached hostname
        (app_id, hostname) = cls.parse_hostname(hostname)
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
        if app:
            memcache.set(memcache_key, app.app_id())
            return app

        # Check for app_id.pageforest.com (et. al.)
        # REVIEW: Is this necessary or will  hostnames always have the
        # canonical hostname in it?
        if app_id:
            app = cls.lookup(app_id)
            if app:
                memcache.set(memcache_key, app.app_id())
                return app
        # No identifiable app.
        else:
            return None

        return cls.create(app_id, hostname)

    @classmethod
    def parse_hostname(cls, hostname):
        """
        Return (app_id, canonical_hostname)

        All primary domains are converted to the default domain name.

        A reference to a naked PF domain is treated as a reference to the
        www.pageforest.com domain with app_id == 'www'.

        >>> App.parse_hostname('app.pageforest.com')
        ('app', 'app.pageforest.com')
        >>> App.parse_hostname('app.pgfrst.com')
        ('app', 'app.pageforest.com')
        >>> App.parse_hostname('app.localhost')
        ('app', 'app.pageforest.com')
        >>> App.parse_hostname('pageforest.com')
        ('www', 'www.pageforest.com')
        >>> App.parse_hostname('a.random.domain')
        (None, 'a.random.domain')
        >>> App.parse_hostname('app.any.number.of.pageforest.appspot.com')
        ('app', 'app.pageforest.com')
        """
        hostname = hostname.lower().split(':')[0]

        # "Naked" domain same as 'www.pageforest.com'
        if hostname in settings.DOMAINS:
            return ('www', 'www.' + settings.DEFAULT_DOMAIN)

        (app_id, dot, sub_domain) = hostname.partition('.')

        # Map all intranet domains to 'www.pageforest.com'
        if sub_domain == '':
            return ('www', 'www.' + settings.DEFAULT_DOMAIN)

        # We treat anything ending in a PF domain as valid
        for domain in settings.DOMAINS:
            if hostname.endswith('.' + domain):
                return (app_id, app_id + '.' + settings.DEFAULT_DOMAIN)

        return (None, hostname)

    @classmethod
    def lookup(cls, app_id):
        """
        Lookup App by app_id (key name for model).
        """
        if app_id is None or app_id in settings.RESERVED_APPS:
            return None

        app = cls.get_by_key_name(app_id)
        if app is None and app_id == 'www':
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

    def app_id(self):
        return self.key().name()

    def generate_session_key(self, user, seconds=None):
        """
        Generate a signed session key for this app and user.

            app_id/user/expires/HMAC(user_password, app_secret)

        This routine can generate a reauth cookie by passing in
        seconds=settings.REAUTH_COOKIE_AGE.

        We use the user.password in the key, so when a user changes his password
        all of his existing session keys are invalidated.
        """
        seconds = seconds or settings.SESSION_COOKIE_AGE
        # REVIEW: Why an ISO expires instead of epoch seconds?
        expires = datetime.now() + timedelta(seconds=seconds)
        secret = crypto.join(user.password, self.secret)
        return crypto.sign(self.app_id(), user.username.lower(), expires, secret)

    def user_from_session_key(self, key):
        try:
            (app_id, username, expires, hmac) = key.split(crypto.SEPARATOR)
            user = User.lookup(username)
            secret = crypto.join(user.password, self.secret)
            crypto.verify(key, secret)
            return user
        except:
            return None


if __name__ == '__main__':
    import doctest
    doctest.testmod()
