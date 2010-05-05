from hashlib import sha1

from google.appengine.ext import db

from django.utils import simplejson as json

from utils.mixins import Cacheable, Migratable, Timestamped
from apps.models import App


class Blob(Cacheable, Migratable, Timestamped):
    """
    Key-value store for PageForest documents and resources.
    Entity key name format: app_id/doc_id/key/with/slashes
    """
    value = db.BlobProperty()
    sha1 = db.StringProperty(indexed=False)
    valid_json = db.BooleanProperty(indexed=False)

    def get_absolute_url(self):
        """
        The URL includes the default domain name for this app.
        """
        app_id, key = self.key().name().split('/', 1)
        app = App.get_by_key_name(app_id)
        return '/'.join(('http:/', app.domains[0], 'docs', key))

    def put(self):
        """
        Update sha1 and valid_json properties automatically before
        each datastore put.
        """
        self.sha1 = sha1(self.value).hexdigest()
        self.valid_json = True
        try:
            json.loads(self.value)
        except ValueError:
            self.valid_json = False
        super(Blob, self).put()
