import re
import logging

from google.appengine.ext import db
from google.appengine.api import memcache

from django.conf import settings
from django.core.urlresolvers import reverse

from utils import crypto

from docs.supermodels import SuperDoc

CACHE_PREFIX = 'GBH1~'


class App(SuperDoc):
    """
    The entity key name contains the app_id, minimum length 2
    characters, always lowercase.

    The url property contains the canonical URL for this app:
    http://scratch.pageforest.com/
    http://github.com/username/scratch/index.html
    https://scrat.ch/

    The trusted_urls property contains additional trusted URL prefixes
    for the Referer header check. If it starts with https, the Referer
    header must also start with https. Otherwise, both http and https
    are trusted. The default http://app_id.pageforest.com/ is always
    trusted, it does not need to be listed here.
    """
    url = db.StringProperty()           # Canonical URL for this app.
    referers = db.StringListProperty()  # URL prefixes for referer check.
    secret = db.BlobProperty()          # Pseudo-random Base64 string.

    def get_absolute_url(self):
        """Get the absolute URL for this model instance."""
        return self.url

    def get_details_url(self):
        """Get the URL for this app's details page on www."""
        return reverse('app.views.details', self.get_app_id())

    def get_app_id(self):
        """Return the key name which contains the app id."""
        return self.key().name()

    def get_form_dict(self):
        """Return a dict that can be used as initial argument for a form."""
        return {
            'app_id': self.get_app_id(),
            'title': self.title,
            'tags': ' '.join(self.tags),
            'readers': ' '.join(self.readers),
            'writers': ' '.join(self.writers),
            'url': self.url,
            'referers': '\n'.join(self.referers),
            }

    def is_www(self):
        """Is this app the Pageforest front-end?"""
        return self.get_app_id() == 'www'

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
            app = App(key_name='www', secret=crypto.random64(),
                      readers=['public'], writers=['public'])
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
        username = user.get_username()
        title = app_id.capitalize()
        url = 'http://%s.%s/' % (app_id, settings.DEFAULT_DOMAIN)
        logging.info("Creating app: %s" % app_id)
        # A new application has public read access by default,
        # but may be updated immediately by app.json upload.
        return App(key_name=app_id, title=title,
                   url=url, secret=crypto.random64(),
                   owner=username, readers=['public'])

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
