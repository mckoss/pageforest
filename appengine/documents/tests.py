from datetime import datetime

from django.test import TestCase
from django.test.client import Client

from apps.models import App
from documents.models import Doc
from storage.models import KeyValue


class DocumentTest(TestCase):

    def setUp(self):
        self.started = datetime.now()
        self.app = App(key_name='myapp', domains=['myapp.pageforest.com'])
        self.app.put()
        self.doc = Doc(key_name='myapp/mydoc',
                       app_id='myapp', doc_id='MyDoc',
                       title="My Document", tags='one two three'.split(),
                       readers=['anybody'], writers=['peter'])
        self.doc.put()
        self.data = KeyValue(key_name='myapp/mydoc', value='{"int": 123}')
        self.data.put()
        self.app_client = Client(HTTP_HOST=self.app.domains[0])

    def test_get_absolute_url(self):
        """Test that the absolute URL is generated correctly."""
        self.assertEqual(self.doc.get_absolute_url(),
                         'http://myapp.pageforest.com/docs/MyDoc/')

    def test_json(self):
        """Test JSON serializer for document."""
        response = self.app_client.get('/docs/MyDoc')
        self.assertContains(response, '"doc_id": "MyDoc"')
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
        # Check that the document ID is case insensitive.
        canonical_content = response.content
        response = self.app_client.get('/docs/mydoc')
        self.assertEqual(response.content, canonical_content)
        response = self.app_client.get('/docs/MYDOC')
        self.assertEqual(response.content, canonical_content)
