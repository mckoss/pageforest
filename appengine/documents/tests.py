from datetime import datetime

from django.test import TestCase

from apps.models import App
from documents.models import Document


class DocumentTest(TestCase):

    def setUp(self):
        self.started = datetime.now()
        self.app = App(key_name='test', default_domain='test.pageforest.com',
                       alt_domains=['testserver'])
        self.app.put()
        self.doc = Document(key_name='test/doc', app_id='test', doc_id='Doc',
                            title="My Document")
        self.doc.put()

    def test_get_absolute_url(self):
        """Test that the absolute URL is generated correctly."""
        self.assertEqual(self.doc.get_absolute_url(),
                         'http://test.pageforest.com/Doc')

    def test_doc(self):
        response = self.client.get('/doc')
        self.assertContains(response, '"title": "My Document"')
