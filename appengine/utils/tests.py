import os
import imp
import doctest
from datetime import datetime

from django.test import TestCase

from google.appengine.ext import db
from google.appengine.api import memcache

from utils.cacheable import Cacheable, CacheHistory
from utils.mixins import Dated


class CachedModel(Cacheable, Dated):
    """Simple datastore model for Cacheable mixin test."""
    text = db.TextProperty()
    blob = db.BlobProperty()


class CacheableTest(TestCase):

    def setUp(self):
        self.started = datetime.now()
        self.entity = CachedModel(key_name='e', text='e', blob='e')
        self.saved = CachedModel(key_name='s', text='s', blob='s')
        self.saved.put()

    def test_put_and_delete(self):
        """Test that put and delete will update memcache."""
        e1 = CachedModel.cache_get_by_key_name('e')
        self.assertEqual(e1, None)
        self.entity.put()
        e2 = CachedModel.cache_get_by_key_name('e')
        self.assertEqual(e2.key().name(), 'e')
        self.entity.delete()
        e3 = CachedModel.cache_get_by_key_name('e')
        self.assertEqual(e3, None)

    def test_get_by_key_name(self):
        """Test the overriden get_by_key_name method."""
        e1 = CachedModel.get_by_key_name('s')
        self.assertEqual(e1.key().name(), 's')
        # Expire memcache and try again.
        memcache.delete(e1.get_cache_key())
        e1 = CachedModel.get_by_key_name('s')
        self.assertEqual(e1.key().name(), 's')

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

    def has_doctest_testmod(self, filename):
        """Check if doctest.testmod() appears in the file."""
        for line in file(filename):
            if line.strip() == 'doctest.testmod()':
                return True

    def test_utils(self):
        """Run doctest on utils modules that support it."""
        dir = os.path.dirname(__file__)
        for filename in os.listdir(dir):
            if not filename.endswith('.py'):
                continue
            full_path = os.path.join(dir, filename)
            if not self.has_doctest_testmod(full_path):
                continue
            base, ext = os.path.splitext(filename)
            file, pathname, desc = imp.find_module(base, [dir])
            mod = imp.load_module('utils.' + base, file, pathname, desc)
            failures, tests = doctest.testmod(mod)
            self.assertEqual(failures, 0)
