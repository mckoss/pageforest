from google.appengine.ext import db


class Document(db.Model):
    """
    The entity key name is the absolute URL of the document.
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
        return self.key().name()
