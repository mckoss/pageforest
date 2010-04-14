from google.appengine.ext import db

from django.conf import settings

from utils.mixins import Cacheable, Dated


class App(Cacheable, Dated):
    """
    The entity key name contains the app_id string.
    """
    default_domain = db.StringProperty()   # Lowercase, fully qualified.
    alt_domains = db.StringListProperty()  # Zero or more lowercase FQDN.
    developers = db.StringListProperty()   # One or more usernames.

    @classmethod
    def get_by_key_name(cls, app_id, parent=None):
        """
        Get app instance from one of these sources:
        * App.cache (dict in the current process)
        * Memcache (using Cacheable.get_by_key_name)
        * Datastore (using db.Model.get_by_key_name)
        """
        if not hasattr(App, 'cache'):
            App.cache = {}
        if app_id in App.cache:
            return App.cache[app_id]
        app = super(App, cls).get_by_key_name(app_id, parent)
        App.cache[app_id] = app
        return app

    @classmethod
    def get_by_hostname(cls, hostname):
        hostname = hostname.lower()
        app = cls.all().filter('default_domain', hostname).get()
        if app:
            return app
        app = cls.all().filter('alt_domain', hostname).get()
        if app:
            return app
        for domain in settings.DOMAINS:
            if hostname.endswith('.' + domain):
                return cls.get_by_key_name(hostname[:-len(domain) - 1])
        return cls.get_by_key_name(hostname)
