from google.appengine.ext import db

from utils.mixins import Cacheable

# The maximum size for each datastore entity is 1048576 bytes.
MAX_CHUNK_SIZE = 1000 * 1000  # bytes


class Chunk(Cacheable):
    """
    The key name is the SHA-1 hash of the content.
    """
    value = db.BlobProperty()
