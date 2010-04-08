import logging

from django.conf import settings

from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.datastore import entity_pb


class Cacheable(db.Model, object):
    """
    Memcache mixin for App Engine datastore models.
    Usage: class MyModel(Cacheable)

    Deriving from Cacheable class provides:
    * Automatic memcache writes in instance.put().
    * Automatic memcache reads in get_by_key_name() or get_or_insert().
    * TODO: Throttled write-through to storage for high-volume writes.

    Cacheable overrides the following methods from db.Model:
    * get_by_key_name(key_name, parent) @classmethod
    * get_or_insert(key_name, **kwargs) @classmethod
    * put()

    Cacheable introduces the following new methods:
    * class_get_cache_key(key_name) @classmethod
    * get_cache_key()
    * cache_get_by_key_name()
    * cache_put()
    """

    def __init__(self, *args, **kwargs):
        super(Cacheable, self).__init__(*args, **kwargs)

    @classmethod
    def class_get_cache_key(cls, key_name):
        """
        Generate a cache key for this key_name.

        C1 is a supposedly unique prefix with a version number.
        Increase it to reset the cache if the serializer is changed.

        The datastore kind of the class is included to create a
        separate namespace for each model.

        TODO: Include settings.CURRENT_VERSION_ID if required.
        """
        return '~'.join(('C1', cls.kind(), key_name))

    def get_cache_key(self):
        """
        Generate a cache key for this model instance.
        """
        return self.class_get_cache_key(self.key().name())

    @classmethod
    def cache_get_by_key_name(cls, key_name):
        """
        Get a model instance from memcache, using protocol buffers.
        Return None if the instance was not found in memcache.
        """
        cache_key = cls.class_get_cache_key(key_name)
        binary = memcache.get(cache_key)
        if binary is None:
            return None
        protobuf = entity_pb.EntityProto(binary)
        instance = db.model_from_protobuf(protobuf)
        if settings.DEBUG:
            logging.info("get_by_key_name used cache: " + cache_key)
        return instance

    @classmethod
    def get_by_key_name(cls, key_name, parent=None):
        """
        Look in memcache before datastore.
        The key_name must be str or unicode, not a list.

        TODO: Support list of key names - will need to fetch partial
        list from datastore for those keys that are not yet cached!
        """
        assert isinstance(key_name, basestring)
        instance = cls.cache_get_by_key_name(key_name)
        if instance is not None:
            return instance
        # Fetch from datastore.
        instance = super(Cacheable, cls).get_by_key_name(key_name, parent)
        if instance is not None:
            if settings.DEBUG:
                logging.info("get_by_key_name used datastore: " +
                             cls._cache_key(key_name))
            instance.ensure_cached()
        return instance

    @classmethod
    def get_or_insert(cls, key_name, **kwargs):
        """
        Look in memcache before datastore.
        The key_name must be str or unicode.
        """
        assert isinstance(key_name, basestring)
        instance = cls.cache_get_by_key_name(key_name)
        if instance is not None:
            return instance
        # Fetch from datastore.
        instance = super(Cacheable, cls).get_or_insert(key_name, **kwargs)
        if instance is not None:
            if settings.DEBUG:
                logging.info("get_or_insert used datastore: " +
                             cls.class_get_cache_key(key_name))
            instance.ensure_cached()
        return instance

    def cache_put(self):
        """
        Save this entity to memcache, using protocol buffers.
        """
        cache_key = self.get_cache_key()
        protobuf = db.model_to_protobuf(self)
        binary = protobuf.Encode()
        memcache.set(cache_key, binary)

    def put(self):
        """
        Save this entitiy to datastore and memcache.
        """
        key = super(Cacheable, self).put()
        if settings.DEBUG:
            logging.info("put used datastore: " + self.get_cache_key())
        self.cache_put()
        return key
