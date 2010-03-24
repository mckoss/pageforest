from google.appengine.ext import db


class Document(db.Model):
    """
    The key_name contains the application name and filename (e.g.
    chess/index.html) and the MIME type is auto-detected by file
    extension.
    """
    content = db.TextProperty()
