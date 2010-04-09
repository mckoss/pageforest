import os
import imp
import doctest
from datetime import datetime

from django.test import TestCase

from google.appengine.ext import db
from google.appengine.api import memcache

from utils.cacheable import Cacheable
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


class DocTest(TestCase):

    def has_doctest_testmod(self, filename):
        for line in file(filename):
            if line.strip() == 'doctest.testmod()':
                return True

    def test_utils(self):
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
