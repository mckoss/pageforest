import logging
import os
import threading

from google.appengine.ext import db
from google.appengine.api import memcache


class Cacheable(db.Model):
    """
    Model caching helper (sub)class

    Usage:

        class MyModel(Cacheable):
            ...

    these are over-ridden methods of Model:

        get_by_key_name(key_name, parent)
            retreives model from cache if possible
        put()
            write-through cache and put to store
        get_or_insert(key_name, **kwds)

    these are additional methods:

        set_dirty() - marks model as dirty or critical - the later forces
            a write to store on exit, the later throttles to one write per
            second for this model
        deferred_put() - writes the model to store if dirty
        ensure_cached() - return a cached instance of the current model
        flush_cache() - put the model, and remove all cached copies

    Deriving from this class provides:

    - Saving models to local storage and memcache where they can be
      retrieved quickly.
    - Throttled write-through to storage for high-volume, but delay-able
      writes.

    Issues:

    Cacheable looks for Model instances in:
        - in request-local storage (for fast local access for same-request
          accesses)
        - in memcache (key'ed on app instance version, model name, and key name
        - in the App Engine data store

    All Cacheable Models must use unique key names (not id's) for their
    instances.

    Queries of this model class will NOT return the cached instance of
    this model. You should call ensure_cached() to get the cached
    version.
    """
    cache_state = util.enum('clean', 'dirty', 'critical')

    def __init__(self, *args, **kwargs):
        self._cache_state = self.cache_state.clean
        self._is_memcached = False
        self._secs_put_last = 0
        # Peak writes to store - once each 2 seconds
        self._write_rate = timescore.RateLimit(30)
        super(Cacheable, self).__init__(*args, **kwargs)

    @classmethod
    def get_by_key_name(cls, key_name, parent=None):
        """
        override the Model.get_by_key_name method, to look in local or memcache
        storage first.

        All key_name(s) must be strings.

        TODO: Support list of key_names - will need to call super are
        partial list of those keys that are not yet cached!
        """
        model = cls._model_from_cache(key_name)
        if model is not None:
            return model

        # Go to storage
        model = super(Cacheable, cls).get_by_key_name(key_name, parent)
        if model is not None:
            if DEBUG:
                logging.info("Reading from storage: %s" %
                             cls._cache_key(key_name))
            model.ensure_cached()

        return model

    @classmethod
    def get_or_insert(cls, key_name, **kwargs):
        # Look in cache first
        model = cls._model_from_cache(key_name)
        if model is not None:
            return model

        # Go to storage
        model = super(Cacheable, cls).get_or_insert(key_name, **kwargs)
        if model is not None:
            model.ensure_cached()

        return model

    def put(self):
        key = super(Cacheable, self).put()

        if DEBUG:
            logging.info("Writing to storage: %s" % self._model_cache_key())

        self._cache_state = self.cache_state.clean
        self.ensure_cached()
        return key

    def set_dirty(self, state=cache_state.dirty):
        """
        Mark the model as having changes to write to the store before
        the request is over.
        """
        self._is_memcached = False
        if state > self._cache_state:
            self._cache_state = state
        self.ensure_cached()

    def deferred_put(self):
        """
        If the model has been marked as dirty, try to write it out.
        """
        if self._cache_state == self.cache_state.clean:
            return

        self.ensure_cached()

        try:
            # Write to storage if critical or dirty AND old
            if self._cache_state == self.cache_state.critical or \
                not self._write_rate.is_exceeded(
                reqfilter.get_request().secsNow):
                self.put()
        except Exception, e:
            logging.info("Failed to write deferred-write cache: %s (%s)" % (
                         self._model_cache_key(),
                         e.message))
            pass

    def ensure_cached(self):
        """
        ensures that this instance is in the cache. If not, it will
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
            raise reqfilter.Error("Replacing modified model from cache: %s" %
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
            if DEBUG:
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

        if DEBUG:
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
