import re
import logging

from google.appengine.ext import db
from google.appengine.api import memcache

from django.conf import settings
from django.core.urlresolvers import reverse

from utils import crypto
from utils.middleware import RequestMiddleware

from docs.supermodels import SuperDoc
from docs.models import Doc

CACHE_PREFIX = 'GBH1~'


class App(SuperDoc):
    """
    The entity key name contains the app_id, minimum length 2
    characters, always lowercase.

    The url property contains the canonical URL for this app:
    http://scratch.pageforest.com/
    http://github.com/username/scratch/index.html
    https://scrat.ch/

    The referers property contains additional trusted URL prefixes
    for the Referer header check. If it starts with https, the Referer
    header must also start with https. Otherwise, both http and https
    are trusted. The default http://app_id.pageforest.com/ is always
    trusted, it does not need to be listed here.
    """
    url = db.StringProperty()           # Canonical URL for this app.
    referers = db.StringListProperty()  # URL prefixes for referer check.
    cloneable = db.BooleanProperty(default=False)  # Opt-in to allow clones.
    secret = db.BlobProperty()          # Pseudo-random Base64 string.
    icon = db.StringProperty()          # Favicon for editor and www.
    secure_data = db.BooleanProperty(default=False)

    """
    (Sub) Versions:
    1: Original schema
    2: 2/24/2011 - added secure_data
    """
    current_schema = SuperDoc.current_schema + 2

    @classmethod
    def json_props(cls):
        props = super(App, cls).json_props()
        props.update(dict.fromkeys(('url', 'referers', 'cloneable', 'icon')))
        props.update({'secure_data': 'secureData'})
        return props

    def get_absolute_url(self):
        """Get the absolute URL for this model instance."""
        return reverse('apps.views.details', args=[self.get_app_id()])

    def get_app_id(self):
        """Return the key name which contains the app id."""
        return self.key().name()

    def blob_key_prefix(self):
        return 'apps/' + self.get_app_id()

    def get_form_dict(self):
        """Return a dict that can be used as initial argument for a form."""
        return {
            'app_id': self.get_app_id(),
            'title': self.title,
            'secureData': self.secure_data,
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
    def create(cls, app_id, username='', **kwargs):
        """
        All user App creation should go through this method.

        TODO: Check quotas and permissions.
        """
        if app_id in settings.RESERVED_APPS:
            raise ValueError("Application is reserved: %s." % app_id)

        kwargs.setdefault('url',
                          'http://%s.%s/' % (app_id, settings.DEFAULT_DOMAIN))

        logging.info("Creating app %s for %s" % (app_id, username))

        title = app_id.capitalize()
        # A new application has private read and write access by default,
        # but may be updated immediately by app.json upload.
        return App(key_name=app_id, owner=username, secret=crypto.random64(),
                   **kwargs)

    def update_from_json(self, parsed, **kwargs):
        super(App, self).update_from_json(parsed, **kwargs)
        self.update_string_property(parsed, 'url', **kwargs)
        self.update_string_property(parsed, 'icon', **kwargs)
        self.update_string_list_property(parsed, 'referers', **kwargs)
        self.update_boolean_property(parsed, 'cloneable', **kwargs)
        self.update_boolean_property(parsed, 'secureData', pykey='secure_data')
        self.update_hash()

    # TODO: Remove this
    def fetch_static_blobs(self, limit=100):
        query = self.all_blobs()
        return query.fetch(limit)

    def all_docs(self, owner=None, keys_only=False):
        """
        Similar to all_blobs() - generate a query object for all the Docs
        belonging to this appliction.

        TODO: The problem with this query is that it cannot be combined with
        any other ordering key.  Need to add an appid to the doc model.
        """
        query = Doc.all(keys_only=keys_only)
        if owner:
            query.filter('owner', owner)
        appid = self.get_app_id()
        query.filter('__key__ >=', db.Key.from_path('Doc', appid + '/'))
        query.filter('__key__ <', db.Key.from_path('Doc', appid + '0'))
        return query
