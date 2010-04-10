import time
import random
import logging

from django.conf import settings

from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.datastore import entity_pb


class CacheHistory(object):

    def __init__(self, cacheable):
        cache_key = cacheable.get_cache_key()
        self.cache_keys = ['CHD~' + cache_key, 'CHM~' + cache_key]
        data = memcache.get_multi(self.cache_keys)
        self.datastore_put = float(data.get(self.cache_keys[0], '0'))
        timestamps = data.get(self.cache_keys[1], '').split()
        self.memcache_puts = [float(t) for t in timestamps]

    def average_put_interval(self):
        count = len(self.memcache_puts) - 1
        if count < 5:  # Not enough confidence to predict the next put.
            return 24 * 60 * 60.0  # One day.
        seconds = max(self.memcache_puts) - min(self.memcache_puts)
        return seconds / count

    def save_datastore_put(self, fake_time=None):
        self.datastore_put = fake_time or time.time()
        memcache.set(self.cache_keys[0], self.datastore_put)

    def serialize_memcache_puts(self):
        timestamps = ['%.3f' % t for t in self.memcache_puts[-10:]]
        return {self.cache_keys[1]: ' '.join(timestamps)}


class Cacheable(db.Model):
    """
    Memcache mixin for App Engine datastore models.
    Usage: class MyModel(Cacheable)

    Inheriting from the Cacheable class provides:
    * Use memcache for put, delete, get_by_key_name, get_or_insert.
    * Limit datastore puts if the write rate is consistently high.

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

    def cache_put(self, extra=None):
        """
        Save this entity to memcache, using protocol buffers.

        If a dictionary is passed as extra argument, its content will
        also be saved to memcache, without extra network latency.
        """
        cache_key = self.get_cache_key()
        protobuf = db.model_to_protobuf(self)
        binary = protobuf.Encode()
        mapping = extra or {}
        mapping[cache_key] = binary
        return memcache.set_multi(mapping)

    def put(self, commit_interval=2.0, fake_time=None):
        """
        Save this entity to datastore and memcache.

        If the interval between puts for this entity (in seconds) is
        consistently smaller than commit_interval, the datastore put
        will be called only once every commit_interval seconds. If the
        datastore put is not called, the return value of this method
        is None instead of the entity key.

        The random jiggle of 500ms prevents a scenario where many
        machines attempt to put to the datastore at once because the
        time since history.datastore_put reaches commit_interval.
        """
        key = None
        now = fake_time
        jiggle = 0.0
        if fake_time is None:
            now = time.time()
            jiggle = 0.5 * random.random()
        # Read history for this entity from memcache.
        history = CacheHistory(self)
        history.memcache_puts.append(now)
        if (now - history.datastore_put + jiggle > commit_interval
            or history.average_put_interval() > commit_interval):
            # Save datastore timestamp to memcache.
            history.save_datastore_put(now)
            # Save entity to datastore.
            key = super(Cacheable, self).put()
        # Save entity and history to memcache.
        self.cache_put(history.serialize_memcache_puts())
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

        Change settings.CACHEABLE_PREFIX before deploying incompatible
        changes like replacing the entity serializer.

        The datastore kind of the class is included to create a
        separate namespace for each model.
        """
        return '~'.join((settings.CACHEABLE_PREFIX, cls.kind(), key_name))

    def get_cache_key(self):
        """Generate a cache key for this model instance."""
        return self.class_get_cache_key(self.key().name())
