import os
import imp
import doctest
import time
from datetime import datetime

from django.test import TestCase

from google.appengine.ext import db
from google.appengine.api import memcache

from utils.cacheable import Cacheable, CacheHistory
from utils.mixins import Dated


class CachedModel(Cacheable, Dated):
    text = db.TextProperty()
    blob = db.BlobProperty()


class CacheableTest(TestCase):

    def setUp(self):
        self.started = datetime.now()
        self.entity = CachedModel(key_name='e', text='e', blob='e')

    def test_get_by_key_name(self):
        """Test that get_by_key_name writes the result to memcache."""
        e1 = CachedModel.cache_get_by_key_name('e')
        self.assertEqual(e1, None)
        self.entity.put()
        e2 = CachedModel.cache_get_by_key_name('e')
        self.assertEqual(e2.key().name(), 'e')
        self.entity.delete()
        e3 = CachedModel.cache_get_by_key_name('e')
        self.assertEqual(e3, None)

    def test_write_rate_limit(self):
        """Test that the datastore put rate is limited."""
        timestamp = time.time()
        self.entity.put()  # One.
        history = CacheHistory(self.entity)
        self.assertEqual(len(history.memcache_puts), 1)
        self.assertAlmostEqual(history.datastore_put, timestamp, 2)
        self.assertAlmostEqual(history.memcache_puts[0], timestamp, 2)
        self.entity.put()  # Two.
        self.entity.put()  # Three.
        self.entity.put()  # Four.
        self.entity.put()  # Five.
        history = CacheHistory(self.entity)
        self.assertEqual(len(history.memcache_puts), 5)
        self.assertTrue(history.memcache_puts[0] < history.datastore_put)
        self.assertTrue(history.memcache_puts[1] < history.datastore_put)
        self.assertEqual(history.memcache_puts[2], history.datastore_put)
        self.assertTrue(history.memcache_puts[3] > history.datastore_put)
        self.assertTrue(history.memcache_puts[4] > history.datastore_put)
        history.datastore_put -= 1.0    # One second earlier.
        self.entity.cache_put(history)  # Overwrite with fake history.
        self.entity.put()  # Six, expecting datastore put because outdated.
        history = CacheHistory(self.entity)
        self.assertEqual(len(history.memcache_puts), 6)
        self.assertEqual(history.memcache_puts[5], history.datastore_put)
        self.entity.put()  # Seven.
        self.entity.put()  # Eight.
        self.entity.put()  # Nine.
        self.entity.put()  # Ten.
        history = CacheHistory(self.entity)
        self.assertEqual(len(history.memcache_puts), 10)
        self.entity.put()  # Eleven.
        history = CacheHistory(self.entity)
        self.assertEqual(len(history.memcache_puts), 10)


class DocTest(TestCase):

    def has_doctest_testmod(self, filename):
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
            fm = imp.find_module(base, [dir])
            mod = imp.load_module('utils.' + base, *fm)
            failures, tests = doctest.testmod(mod)
            self.assertEqual(failures, 0)
