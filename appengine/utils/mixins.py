from google.appengine.ext import db

from utils.cacheable import Cacheable
from utils.migratable import Migratable


class Dated(db.Model):
    """
    Standardized timestamp information for models.
    """
    created = db.DateTimeProperty(auto_now_add=True)
    modified = db.DateTimeProperty(auto_now=True)
