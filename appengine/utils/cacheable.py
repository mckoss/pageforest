import time
import logging

from django.conf import settings

from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.datastore import entity_pb


class CacheHistory(object):

    def __init__(self, cacheable):
        self.datastore_put = 0.0  # The beginning of time (1970).
        self.memcache_puts = []
        self.cache_key = 'PH~' + cacheable.get_cache_key()
        data = memcache.get(self.cache_key)
        if data is None:
            return
        timestamps = data.split()
        if len(timestamps) < 1:
            return
        self.datastore_put = float(timestamps.pop(0))
        self.memcache_puts = [float(t) for t in timestamps]

    def average_put_interval(self):
        count = len(self.memcache_puts) - 1
        if count < 3:
            return 24 * 60 * 60.0  # One day.
        seconds = self.memcache_puts[-1] - self.memcache_puts[0]
        return seconds / count

    def serialize(self):
        timestamps = [self.datastore_put] + self.memcache_puts[-10:]
        return ' '.join(['%.3f' % t for t in timestamps])


class Cacheable(db.Model, object):
    """
    Memcache mixin for App Engine datastore models.
    Usage: class MyModel(Cacheable)

    Inheriting from the Cacheable class provides:
    * Use memcache for put, delete, get_by_key_name, get_or_insert.
    * TODO: Throttled write-through to storage for high-volume writes.

    Cacheable overrides the following methods from db.Model:
    * put()
    * delete()
    * @classmethod get_by_key_name(key_name, parent)
    * @classmethod get_or_insert(key_name, **kwargs)

    Cacheable introduces the following new methods:
    * cache_put()
    * cache_delete()
    * @classmethod cache_get_by_key_name()
    * @classmethod class_get_cache_key(key_name)
    * get_cache_key()
    """

    def __init__(self, *args, **kwargs):
        super(Cacheable, self).__init__(*args, **kwargs)

    def cache_put(self, history=None):
        """
        Save this entity to memcache, using protocol buffers.

        If available, the put history will be saved separately, but
        using only one memcache call for both entity and history.
        """
        cache_key = self.get_cache_key()
        protobuf = db.model_to_protobuf(self)
        binary = protobuf.Encode()
        mapping = {cache_key: binary}
        if history:
            mapping[history.cache_key] = history.serialize()
        return memcache.set_multi(mapping)

    def put(self, commit_interval=1.0):
        """
        Save this entity to datastore and memcache.

        If the interval between puts for this entity (in seconds) is
        consistently smaller than commit_interval, the datastore put
        will be called only once every commit_interval seconds. If the
        datastore put is not called, the return value of this method
        is None instead of the entity key.
        """
        key = None
        history = CacheHistory(self)
        now = time.time()
        history.memcache_puts.append(now)
        if (len(history.memcache_puts) < 4
            or history.average_put_interval() > commit_interval
            or now - history.datastore_put > commit_interval):
            key = super(Cacheable, self).put()
            # Reload history after slow datastore put.
            now = time.time()
            history = CacheHistory(self)
            history.memcache_puts.append(now)
            history.datastore_put = now
        # Save entity and history to memcache.
        self.cache_put(history)
        return key

    def cache_delete(self):
        """Remove this entity from memcache."""
        cache_key = self.get_cache_key()
        return memcache.delete(cache_key)

    def delete(self):
        """Remove this entity from datastore and memcache."""
        self.cache_delete()  # First because it needs self.key().name().
        super(Cacheable, self).delete()

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
            instance.cache_put()
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
        """Generate a cache key for this model instance."""
        return self.class_get_cache_key(self.key().name())
