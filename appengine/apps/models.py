from google.appengine.ext import db

from django.conf import settings

from utils.mixins import Cacheable, Dated


class App(Cacheable, Dated):
    """
    The entity key name contains the app_id string.
    """
    domain = db.StringProperty()           # Lowercase, fully qualified.
    alt_domains = db.StringListProperty()  # Zero or more lowercase FQDN.
    developers = db.StringListProperty()   # One or more usernames.
    secret = db.BlobProperty()             # Pseudo-random Base64 string.

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
        """
        Find the app that serves a given domain. The matching is case
        insensitive and ignores ports like :8080.

        Possible matches are checked in this order:
        * hostname == domain
        * hostname in alt_domains
        * hostname == key_name + '.' + one of settings.DOMAINS
        * hostname == key_name
        * hostname == 'localhost' creates dummy app if settings.DEBUG
        """
        hostname = hostname.lower().split(':')[0]
        app = cls.all().filter('domain', hostname).get()
        if app:
            return app
        app = cls.all().filter('alt_domains', hostname).get()
        if app:
            return app
        for domain in settings.DOMAINS:
            if hostname.endswith('.' + domain):
                app = cls.get_by_key_name(hostname[:-len(domain) - 1])
                if app:
                    return app
        app = cls.get_by_key_name(hostname)
        if app:
            return app
        if settings.DEBUG:
            app_id = hostname.split('.')[0]
            return App(key_name=app_id, app_id=app_id)
