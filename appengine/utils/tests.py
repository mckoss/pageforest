import os
import imp
import doctest

from django.test import TestCase

from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.runtime import apiproxy_errors

from utils.mixins import Timestamped, Migratable, Cacheable
from utils.mixins.cacheable import CacheHistory


class TestModel(Timestamped, Migratable, Cacheable):
    """Simple datastore model for testing mixins."""
    text = db.TextProperty()
    blob = db.BlobProperty()


class CacheableTest(TestCase):

    def setUp(self):
        self.entity = TestModel(key_name='e', text='e', blob='e')
        self.saved = TestModel(key_name='s', text='s', blob='s')
        self.saved.put()

    def test_put_and_delete(self):
        """Put and delete should update memcache."""
        # Check that the entity is not saved yet.
        self.assertFalse(TestModel.exists('e'))
        self.assertEqual(TestModel.cache_get_by_key_name('e'), None)
        # Save entity.
        self.entity.put()
        # Retrieve entity from memcache.
        entity = TestModel.cache_get_by_key_name('e')
        self.assertEqual(entity.key().name(), 'e')
        # Test the exists method using memcache and datastore.
        self.assertTrue(TestModel.exists('e'))
        memcache.delete(self.entity.get_cache_key())
        self.assertTrue(TestModel.exists('e'))
        # Delete entity and test the exists method again.
        self.entity.delete()
        self.assertFalse(TestModel.exists('e'))
        self.assertEqual(TestModel.cache_get_by_key_name('e'), None)

    def test_get_by_key_name(self):
        """The get_by_key_name method should load from memcache."""
        entity = TestModel.get_by_key_name('s')
        self.assertEqual(entity.key().name(), 's')
        # Expire memcache and try again.
        memcache.delete(entity.get_cache_key())
        entity = TestModel.get_by_key_name('s')
        self.assertEqual(entity.key().name(), 's')

    def test_get_by_key_name_list(self):
        """The get_by_key_name method should support a list of names."""
        # Make sure that one entity is in memcache and the other isn't.
        self.entity.cache_put()
        self.saved.cache_delete()
        # Try to load both entities.
        entities = TestModel.get_by_key_name(['e', 's'])
        self.assertEqual(len(entities), 2)
        self.assertEqual(entities[0].key().name(), 'e')
        self.assertEqual(entities[1].key().name(), 's')
        # Both entities should be in memcache now.
        self.assertTrue(memcache.get(self.entity.get_cache_key()))
        self.assertTrue(memcache.get(self.saved.get_cache_key()))

    def test_write_rate_limit(self):
        """Test that the datastore put rate is limited."""
        self.entity.put(fake_time=1270833107.0)
        history = CacheHistory(self.entity)
        self.assertEqual(history.datastore_put, 1270833107.0)
        self.assertEqual(history.memcache_puts, [1270833107.0])
        self.assertEqual(history.average_put_interval(), 3600.0)
        self.entity.put(fake_time=1270833107.1)
        self.entity.put(fake_time=1270833107.3)
        self.entity.put(fake_time=1270833107.4)
        self.entity.put(fake_time=1270833107.5)
        self.entity.put(fake_time=1270833107.2)
        self.entity.put(fake_time=1270833107.6)
        history = CacheHistory(self.entity)
        self.assertEqual(len(history.memcache_puts), 7)
        self.assertEqual(history.memcache_puts, [
                1270833107.0, 1270833107.1, 1270833107.2, 1270833107.3,
                1270833107.4, 1270833107.5, 1270833107.6])
        self.assertEqual(history.datastore_put, 1270833107.5)
        self.assertAlmostEqual(history.average_put_interval(), 0.1)
        # Fake datastore put, two seconds earlier.
        history.datastore_put -= 2.0
        memcache.set_multi(history.serialize_datastore_put())
        # The next put should go to the datastore.
        self.entity.put(fake_time=1270833107.7)
        history = CacheHistory(self.entity)
        self.assertEqual(len(history.memcache_puts), 8)
        self.assertEqual(history.memcache_puts[-1], history.datastore_put)
        self.entity.put(fake_time=1270833107.8)
        self.entity.put(fake_time=1270833107.9)
        history = CacheHistory(self.entity)
        self.assertEqual(len(history.memcache_puts), 10)
        self.entity.put(fake_time=1270833108.9)
        history = CacheHistory(self.entity)
        self.assertEqual(history.memcache_puts, [
                1270833107.1, 1270833107.2, 1270833107.3, 1270833107.4,
                1270833107.5, 1270833107.6, 1270833107.7, 1270833107.8,
                1270833107.9, 1270833108.9])
        self.assertAlmostEqual(history.average_put_interval(), 0.2)


class DocTest(TestCase):

    def ignore_file(self, filename):
        """Return True if the file does not contain doctest.testmod()."""
        for line in file(filename):
            if line.strip() == 'doctest.testmod()':
                return False
        return True

    def test_utils(self):
        """Run doctest on utils modules that support it."""
        dir = os.path.dirname(__file__)
        for filename in os.listdir(dir):
            if not filename.endswith('.py'):
                continue
            full_path = os.path.join(dir, filename)
            if self.ignore_file(full_path):
                continue
            (base, ext) = os.path.splitext(filename)
            (file, pathname, desc) = imp.find_module(base, [dir])
            mod = imp.load_module('utils.' + base, file, pathname, desc)
            (failures, tests) = doctest.testmod(mod)
            self.assertEqual(failures, 0)


class ApiProxyErrorTest(TestCase):

    def test_capability_disabled(self):
        """CapabilityDisabledError should return status code 503."""
        self.assertContains(self.client.get('/errors/capability-disabled'),
                            "disabled", status_code=503)

    def test_over_quota(self):
        """OverQuotaError should return status code 503."""
        self.assertContains(self.client.get('/errors/over-quota'),
                            "quota", status_code=503)

    def test_apiproxy_error(self):
        """Other API proxy errors should not be caught."""
        self.assertRaises(apiproxy_errors.Error,
                          self.client.get, '/errors/apiproxy-error')
