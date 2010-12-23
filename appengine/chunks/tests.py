import datetime
import hashlib

from google.appengine.ext import db
from google.appengine.api import memcache

from django.conf import settings
from django.test import Client
from django.utils import simplejson as json

from apps.tests import AppTestCase

from apps.models import App
from docs.models import Doc
from blobs.models import Blob, MAX_INTERNAL_SIZE
from chunks.models import Chunk


class ChunkTest(AppTestCase):

    def setUp(self):
        super(ChunkTest, self).setUp()
        self.sign_in(self.peter)
        response = self.app_client.put('/docs/mydoc/key/', 'a' * MAX_INTERNAL_SIZE + 'b',
                                       content_type='text/plain')

    def test_vacuum(self):
        """Chunk vacuuming."""
        response = self.www_client.get('/chunks/cron/vacuum/0')
        self.assertContains(response, 'Found 1 chunks')
        self.assertContains(response, 'and 4 blobs')
        self.assertContains(response, '235a7d')
        response = self.app_client.delete('/docs/mydoc/key/')
        self.assertEqual(response.status_code, 200)
        response = self.www_client.get('/chunks/cron/vacuum/0')
        self.assertContains(response, 'Found 1 chunks')
        self.assertContains(response, 'and 3 blobs')
        self.assertContains(response, '1 Chunks without Blobs')
        response = self.www_client.post('/chunks/cron/vacuum/0', {'confirmed': 'Delete'})
        self.assertTrue(response.status_code, 200)
        response = self.www_client.get('/chunks/cron/vacuum/0')
        self.assertContains(response, 'Found 0 chunks')
        self.assertNotContains(response, 'Chunks without Blobs')
        response = self.app_client.put('/docs/mydoc/key/', 'a' * MAX_INTERNAL_SIZE + 'b',
                                       content_type='text/plain')
        response = self.www_client.get('/chunks/cron/vacuum/0')
        self.assertContains(response, 'Found 1 chunks')
        self.assertContains(response, 'and 4 blobs')
        self.assertNotContains(response, 'Blobs without Chunks')
