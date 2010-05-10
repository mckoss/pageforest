import re
import logging

from google.appengine.ext import db
from google.appengine.api import memcache

from django.conf import settings

from utils import crypto

from docs.supermodels import SuperDoc

CACHE_PREFIX = 'GBH1~'

# 2010-04-29.latest.pageforest.appspot.com
STAGING_DOMAIN_REGEX = '([^\.]+)\.latest\.pageforest\.appspot\.com$'
STAGING_DOMAIN_MATCH = re.compile(STAGING_DOMAIN_REGEX).match

# myapp.2010-04-29.latest.pageforest.appspot.com
APP_STAGING_DOMAIN_REGEX = '(%s)\.%s' % (
    settings.APP_ID_REGEX, STAGING_DOMAIN_REGEX)
APP_STAGING_DOMAIN_MATCH = re.compile(APP_STAGING_DOMAIN_REGEX).match


class App(SuperDoc):
    """
    The entity key name contains apps/app_id, minimum length of app_id
    2 characters, and it's always lowercase.

    The first entry in domains is the default domain.
    The first entry in developers is the owner.
    """
    domains = db.StringListProperty()      # One or more lowercase FQDN.
    secret = db.BlobProperty()             # Pseudo-random Base64 string.

    def get_absolute_url(self):
        """Get the absolute URL for this model instance."""
        if self.domains:
            domain = self.domains[0]
        else:
            domain = self.get_app_id() + '.' + settings.DEFAULT_DOMAIN
        return ''.join(('http://', domain, '/'))

    def get_app_id(self):
        """Return the key name which contains the app id."""
        return self.key().name()

    def is_www(self):
        """Is this app the Pageforest front-end?"""
        return self.get_app_id() == 'www'

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
            memcache.set(memcache_key, app.get_app_id())
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
        >>> App.app_id_from_hostname('app.2010.latest.pageforest.appspot.com')
        'app'
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
            app = App(key_name='www',
                      domains=['www.' + settings.DEFAULT_DOMAIN],
                      secret=crypto.random64())
            app.put()
        return app

    @classmethod
    def create(cls, app_id, user):
        """
        All App creation should go through this method.

        TODO: Check quotas and permissions.
        """
        if user is None:
            raise ValueError("The user is None.")
        if app_id in settings.RESERVED_APPS:
            raise ValueError("Application %s is reserved." % app_id)
        hostname = app_id + '.' + settings.DEFAULT_DOMAIN
        username = user.get_username()
        title = app_id.capitalize()
        logging.info("Creating app: %s" % app_id)
        return App(key_name=app_id,
                   title=title,
                   domains=[hostname],
                   secret=crypto.random64(),
                   readers=[username],
                   writers=[username])

    def update_tags(self, tags, user):
        """
        Update tags for this app, unless they start with underscore.
        """
        accepted = [tag for tag in tags if not tag.startswith('_')]
        reserved = [tag for tag in self.tags if tag.startswith('_')]
        self.tags = accepted + reserved

    def update_writers(self, writers, user):
        """
        Update writers for this app, make sure that the current user
        is not removing his own write permissions.
        """
        self.writers = writers
        username = user.get_username()
        for attempt in ('public', 'authenticated', username):
            if username in self.writers:
                return
        self.writers.append(username)
