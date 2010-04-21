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
                            title="My Document", owner='peter',
                            tags='one two three'.split())
        self.doc.put()
        self.data = KeyValue(key_name='test/doc', app_id='test', doc_id='Doc',
                             value='{"int": 123}')
        self.data.put()
        self.app_client = Client(HTTP_HOST=self.app.domains[0])

    def test_get_absolute_url(self):
        """Test that the absolute URL is generated correctly."""
        self.assertEqual(self.doc.get_absolute_url(),
                         'http://test.pageforest.com/Doc')

    def test_json(self):
        """Test JSON serializer for document."""
        response = self.app_client.get('/doc')
        self.assertContains(response, '"app_id": "test"')
        self.assertContains(response, '"doc_id": "Doc"')
        self.assertContains(response, '"title": "My Document"')
        self.assertContains(response, '"owner": "peter"')
        self.assertNotContains(response, '"readers":')
        self.assertNotContains(response, '"writers":')
        self.assertContains(response, '"tags": ["one", "two", "three"]')
        self.assertContains(response, '"created": {')
        self.assertContains(response, '"modified": {')
        self.assertContains(response, '"__class__": "Date"')
        self.assertContains(response, '"isoformat": "201')
        self.assertContains(response, '"json": {"int": 123}')
