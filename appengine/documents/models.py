from google.appengine.ext import db

from django.conf import settings


class Document(db.Model):
    """
    Metadata for each PageForest document.
    Entity key name format: app_id/doc_id
    """
    title = db.StringProperty()
    json = db.TextProperty()
    owner = db.StringProperty()        # Username of the creator.
    readers = db.StringListProperty()  # Usernames that have read access.
    writers = db.StringListProperty()  # Usernames that have write access.
    tags = db.StringListProperty()
    created = db.DateTimeProperty()
    modified = db.DateTimeProperty()

    def get_absolute_url(self):
        app_id, doc_id = self.key().name().split('/')
        return 'http://%s.%s/%s' % (app_id, settings.DEFAULT_DOMAIN, doc_id)
