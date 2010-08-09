from google.appengine.ext import db

from utils.mixins import Cacheable


class Chunk(Cacheable):
    """
    The key name is the SHA-1 hash of the content.
    """
    value = db.BlobProperty()
