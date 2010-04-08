import logging
import os
import threading

from django.conf import settings

from google.appengine.ext import db
from google.appengine.api import memcache


class Cacheable(db.Model, object):
    """
    Model caching helper class.
    Usage: class MyModel(Cacheable): ...

    This overrides the following Model methods:
    * get_by_key_name(key_name, parent)
    * get_or_insert(key_name, **kwds)
    * put()

    These are additional methods:
    * ensure_cached() - return a cached instance of the current instance
    * flush_cache() - put the instance, and remove all cached copies

    Deriving from this class provides:
    * Saving instances to local storage and memcache.
    * Throttled write-through to storage for high-volume writes.

    Cacheable looks for Model instances in:
    * request-local storage (for fast local access during same request)
    * memcache (keyed on app instance version, model and key name)
    * App Engine datastore

    Datastore queries of this model class will NOT return the cached
    instances. You should call ensure_cached() to read from the cache.
    """

    def __init__(self, *args, **kwargs):
        super(Cacheable, self).__init__(*args, **kwargs)
        self._writes_per_second = 0.0

    @classmethod
    def get_by_key_name(cls, key_name, parent=None):
        """
        Look in local or memcache before datastore.
        The key_name must be str or unicode, not a list.

        TODO: Support list of key names - will need to fetch partial
        list from datastore for those keys that are not yet cached!
        """
        assert isinstance(key_name, basestring)
        model = cls._model_from_cache(key_name)
        if model is not None:
            return model
        # Fetch from datastore.
        model = super(Cacheable, cls).get_by_key_name(key_name, parent)
        if model is not None:
            if settings.DEBUG:
                logging.info("datastore get_by_key_name: " +
                             cls._cache_key(key_name))
            model.ensure_cached()
        return model

    @classmethod
    def get_or_insert(cls, key_name, **kwargs):
        """
        Look in local or memcache before datastore.
        The key_name must be str or unicode.
        """
        assert isinstance(key_name, basestring)
        model = cls._model_from_cache(key_name)
        if model is not None:
            return model
        # Fetch from datastore.
        model = super(Cacheable, cls).get_or_insert(key_name, **kwargs)
        if model is not None:
            if settings.DEBUG:
                logging.info("datastore get_or_insert: " +
                             cls._cache_key(key_name))
            model.ensure_cached()
        return model

    def put(self):
        """
        Write to datastore and memcache and local.
        """
        key = super(Cacheable, self).put()
        if settings.DEBUG:
            logging.info("datastore put: " + self._model_cache_key())
        self.ensure_cached()
        return key

    def ensure_cached(self):
        """
        Ensures that this instance is in the cache. If not, it will
        replace any existing instance from the cache - so any local
        modifications will be written to the cache (but not storage).

        Any modifications to the previously cached version will be lost!
        """
        model = self._model_from_cache(self.key().name())
        if model is self:
            # Not memcached -> write it so available to other instances/threads
            if not self._is_memcached:
                self._write_to_cache(self)
            return

        if model is not None and model._cache_state != self.cache_state.clean:
            logging.error("Replacing modified model from cache: %s" %
                          self._model_cache_key())

        self._write_to_cache(self)

    def is_cached(self):
        model = self._model_from_cache(self.key().name())
        return model is self

    @classmethod
    def _model_from_cache(cls, key_name):
        sKey = cls._cache_key(key_name)

        # Check if in request-local store
        local_store = cls._local_store()
        if sKey in local_store:
            return local_store[sKey]

        # Check if in memcache - and update local store
        model = memcache.get(sKey)
        if model is not None:
            if settings.DEBUG:
                logging.info("Reading from global cache: %s" % sKey)
            local_store[sKey] = model

            # Don't copy the cache_state from another instance/request
            model._cache_state = cls.cache_state.clean
            model._in_memcache = True
            return model

        return None

    @staticmethod
    def _write_to_cache(model):
        """
        unconditionally write the model to the local and memcache stores
        """
        sKey = model._model_cache_key()

        if settings.DEBUG:
            logging.info("Writing to cache: %s" % sKey)

        model._local_store()[sKey] = model
        memcache.set(sKey, model)

        model._is_memcached = True

    def _model_cache_key(self):
        return self._cache_key(self.key().name())

    @classmethod
    def _cache_key(cls, key_name):
        # BUG: cls.__name__ probably not correct for PolyModel classes!
        return "%s~%s~Cache~%s" % (
               cls.__name__,
               key_name,
               os.environ['CURRENT_VERSION_ID'])

    @staticmethod
    def _local_store():
        return local.cache_storage


class CacheFilter(object):
    def process_response(self, req, resp):
        write_deferred_cache()
        return resp


def write_deferred_cache():
    for key, model in local.cache_storage.items():
        model.deferred_put()

local = threading.local()
local.cache_storage = {}


def unique_models(models):
    """
    de-dup the list of models by comparing their keys to remove duplicates.

    Assumes all models are of the same type.
    """
    keys = set()
    unique_models = []

    for model in models:
        key = model.key().id_or_name()
        if key in keys:
            continue
        keys.add(key)
        unique_models.append(model)

    return unique_models


def exclude_models(models, models_exclude):
    keys_exclude = set((model.key().id_or_name() for model in models_exclude))
    results = [model for model in models
               if model.key().id_or_name() not in keys_exclude]
    return results
