import time
import random
import logging

from django.conf import settings

from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.datastore import entity_pb

from utils.mixins.serializable import Serializable


class CacheHistory(object):
    """
    Remember timestamps for last datastore put and the last 10
    memcache puts, to estimate the average put interval.
    """

    def __init__(self, cacheable):
        cache_key = cacheable.get_cache_key()
        self.chd_key = 'CHD~' + cache_key
        self.chm_key = 'CHM~' + cache_key
        data = memcache.get_multi([self.chd_key, self.chm_key])
        self.datastore_put = float(data.get(self.chd_key, '0'))
        timestamps = data.get(self.chm_key, '').split()
        self.memcache_puts = [float(t) for t in timestamps]

    def average_put_interval(self):
        """
        Average interval between memcache puts, in seconds.
        """
        count = len(self.memcache_puts) - 1
        if count < 5:  # Not enough confidence to predict the next put.
            return 3600.0  # One hour.
        self.memcache_puts.sort()
        seconds = self.memcache_puts[-1] - self.memcache_puts[0]
        return seconds / count

    def serialize_datastore_put(self):
        """String representation of the last datastore put timestamp."""
        return {self.chd_key: '%.3f' % self.datastore_put}

    def serialize_memcache_puts(self):
        """String representation of the last 10 memcache put timestamps."""
        self.memcache_puts.sort()
        timestamps = ['%.3f' % t for t in self.memcache_puts[-10:]]
        return {self.chm_key: ' '.join(timestamps)}


class Cacheable(Serializable):
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
        if not settings.RUNNING_ON_GAE:
            self.check_mro()
        super(Cacheable, self).__init__(*args, **kwargs)

    def check_mro(self):
        """
        Make sure that Cacheable is the last mixin in the MRO.
        """
        found = False
        for cls in self.__class__.__mro__:
            if found and cls not in (Serializable, db.Model, object):
                raise TypeError(
                    "Cacheable must be the last mixin: " + ' '.join(
                        [c.__name__ for c in self.__class__.__mro__]))
            if cls is Cacheable:
                found = True

    def cache_put(self):
        """Save this entity to memcache, using protocol buffers."""
        key = self.get_cache_key()
        value = self.to_protobuf()
        return memcache.set(key, value)

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

        TODO: Batch put without many calls for memcache and datastore.
        """
        now = fake_time
        jiggle = 0.0
        # Use current time and jiggle, unless fake_time was specified.
        if fake_time is None:
            now = time.time()
            jiggle = 0.5 * random.random()
        # Read commit history for this entity from memcache.
        history = CacheHistory(self)
        history.memcache_puts.append(now)
        # Check if we should write to the datastore.
        commit = False
        if now - history.datastore_put + jiggle > commit_interval:
            commit = True  # The last datastore put was too long ago.
        elif history.average_put_interval() > commit_interval:
            commit = True  # Infrequent updates or not enough confidence.
        # Save entity and history to memcache.
        mapping = {self.get_cache_key(): self.to_protobuf()}
        mapping.update(history.serialize_memcache_puts())
        if commit:
            history.datastore_put = now
            mapping.update(history.serialize_datastore_put())
        memcache.set_multi(mapping)
        # Save entity to datastore, if necessary.
        if commit:
            return super(Cacheable, self).put()

    def cache_delete(self):
        """Remove this entity from memcache."""
        cache_key = self.get_cache_key()
        return memcache.delete(cache_key)

    def delete(self):
        """Remove this entity from datastore and memcache."""
        self.cache_delete()  # First because it needs self.key().name().
        super(Cacheable, self).delete()

    @classmethod
    def get(cls, keys):
        """
        TODO: Use memcache here.
        """
        return super(Cacheable, cls).get(keys)

    @classmethod
    def cache_get_by_key_name(cls, key_name):
        """
        Get a model instance from memcache, using protocol buffers.
        Return None if the instance was not found in memcache.
        """
        if isinstance(key_name, list):
            return cls.cache_get_by_key_name_list(key_name)
        cache_key = cls.class_get_cache_key(key_name)
        binary = memcache.get(cache_key)
        if binary is None:
            return None
        protobuf = entity_pb.EntityProto(binary)
        instance = db.model_from_protobuf(protobuf)
        if settings.CACHEABLE_LOGGING:
            logging.info("get_by_key_name used memcache: " + cache_key)
        return instance

    @classmethod
    def get_by_key_name_list(cls, key_name_list, parent=None):
        """
        Get a list of model instances from memcache or datastore.
        """
        result = {}
        # Try to load entities from memcache.
        cache_keys = [cls.class_get_cache_key(key_name)
                      for key_name in key_name_list]
        from_memcache = memcache.get_multi(cache_keys)
        # Find the key names of missing entities.
        missing = []
        for key_name, cache_key in zip(key_name_list, cache_keys):
            if cache_key in from_memcache:
                result[key_name] = cls.from_protobuf(from_memcache[cache_key])
            else:
                missing.append(key_name)
        # Load missing entities from datastore.
        if missing:
            from_datastore = super(Cacheable, cls).get_by_key_name(
                missing, parent)
            # Save loaded entities to memcache.
            to_memcache = {}
            for key_name, instance in zip(missing, from_datastore):
                result[key_name] = instance
                to_memcache[instance.get_cache_key()] = instance.to_protobuf()
            memcache.set_multi(to_memcache)
        return [result[key_name] for key_name in key_name_list]

    @classmethod
    def get_by_key_name(cls, key_name, parent=None):
        """
        Look in memcache before datastore.
        """
        if not isinstance(key_name, basestring):
            return cls.get_by_key_name_list(key_name, parent=parent)
        instance = cls.cache_get_by_key_name(key_name)
        if instance is not None:
            return instance
        # Fetch from datastore.
        instance = super(Cacheable, cls).get_by_key_name(key_name, parent)
        if instance is not None:
            if settings.CACHEABLE_LOGGING:
                logging.info("get_by_key_name used datastore: " +
                             cls.class_get_cache_key(key_name))
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
            if settings.CACHEABLE_LOGGING:
                logging.info("get_or_insert used datastore: " +
                             cls.class_get_cache_key(key_name))
            instance.ensure_cached()
        return instance

    @classmethod
    def exists(cls, key_name):
        """
        Check if an entity with this key name exists, without actually
        loading the entity from the datastore.
        """
        cache_key = cls.class_get_cache_key(key_name)
        if memcache.get(cache_key) is not None:
            return True
        query = cls.all(keys_only=True)
        query.filter('__key__', db.Key.from_path(cls.kind(), key_name))
        return bool(query.count())

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
