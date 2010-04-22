from datetime import datetime

from django.test import TestCase
from django.test.client import Client

from apps.models import App
from documents.models import Document
from storage.models import KeyValue


class DocumentTest(TestCase):

    def setUp(self):
        self.started = datetime.now()
        self.app = App(key_name='test', domains=['test.pageforest.com'])
        self.app.put()
        self.doc = Document(key_name='test/doc', app_id='test', doc_id='Doc',
                            title="My Document", tags='one two three'.split(),
                            readers=['anybody'], writers=['peter'])
        self.doc.put()
        self.data = KeyValue(key_name='test/doc', app_id='test', doc_id='Doc',
                             value='{"int": 123}')
        self.data.put()
        self.app_client = Client(HTTP_HOST=self.app.domains[0])

    def test_get_absolute_url(self):
        """Test that the absolute URL is generated correctly."""
        self.assertEqual(self.doc.get_absolute_url(),
                         'http://test.pageforest.com/docs/Doc')

    def test_json(self):
        """Test JSON serializer for document."""
        response = self.app_client.get('/docs/doc')
        self.assertContains(response, '"app_id": "test"')
        self.assertContains(response, '"doc_id": "Doc"')
        self.assertContains(response, '"title": "My Document"')
        self.assertContains(response, '"readers": ["anybody"]')
        self.assertContains(response, '"writers": ["peter"]')
        self.assertContains(response, '"schema": 1')
        self.assertContains(response, '"tags": ["one", "two", "three"]')
        self.assertContains(
            response, '"created": {"__class__": "Date", "isoformat": "201')
        self.assertContains(
            response, '"modified": {"__class__": "Date", "isoformat": "201')
        self.assertContains(response, '"json": {"int": 123}')
