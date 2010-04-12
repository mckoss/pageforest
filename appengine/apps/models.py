from google.appengine.ext import db

from utils.mixins import Cacheable, Dated


class App(Cacheable, Dated):
    """
    The entity key name contains the app_id string.
    """
    default_domain = db.StringProperty()   # Fully qualified domain name.
    alt_domains = db.StringListProperty()  # Zero or more FQDN.
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
