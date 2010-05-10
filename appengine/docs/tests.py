import datetime
from mock import Mock

from django.conf import settings
from django.test import TestCase
from django.test.client import Client

from auth.models import User
from apps.models import App
from docs.models import Doc
from blobs.models import Blob


class DocumentTest(TestCase):

    def setUp(self):
        self.peter = User(key_name='peter', username='Peter')
        self.peter.put()
        self.paul = User(key_name='paul', username='Paul')
        self.paul.put()
        self.app = App(key_name='myapp', domains=['myapp.pageforest.com'])
        self.app.put()
        self.doc = Doc(key_name='myapp/mydoc',
                       app_id='myapp', doc_id='MyDoc',
                       title="My Document", tags='one two three'.split(),
                       readers=['public'], writers=['peter', 'authenticated'])
        self.doc.put()
        self.blob = Blob(key_name='myapp/mydoc/', value='{"int": 123}')
        self.blob.put()
        self.app_client = Client(HTTP_HOST=self.app.domains[0])

    def test_get_absolute_url(self):
        """Test that the absolute URL is generated correctly."""
        self.assertEqual(self.doc.get_absolute_url(),
                         'http://myapp.pageforest.com/docs/MyDoc/')

    def test_json(self):
        """Test JSON serializer for document."""
        response = self.app_client.get('/docs/MyDoc/')
        self.assertContains(response, '"doc_id": "MyDoc"')
        self.assertContains(response, '"title": "My Document"')
        self.assertContains(response, '"readers": ["public"]')
        self.assertContains(response, '"writers": ["peter", "authenticated"]')
        self.assertContains(response, '"schema": 1')
        self.assertContains(response, '"tags": ["one", "two", "three"]')
        self.assertContains(
            response, '"created": {"__class__": "Date", "isoformat": "201')
        self.assertContains(
            response, '"modified": {"__class__": "Date", "isoformat": "201')
        self.assertContains(response, '"blob": {"int": 123}')
        # Check that the document ID is case insensitive.
        canonical_content = response.content
        response = self.app_client.get('/docs/mydoc')
        self.assertEqual(response.content, canonical_content)
        response = self.app_client.get('/docs/MYDOC')
        self.assertEqual(response.content, canonical_content)

    def test_read_permissions(self):
        """Test access control in document_get."""
        # Document owner should have read permission.
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.app)
        response = self.app_client.get('/docs/MyDoc/')
        self.assertContains(response, '"title": "My Document"')
        # Other users should have read permission.
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.paul.generate_session_key(self.app)
        response = self.app_client.get('/docs/MyDoc/')
        self.assertContains(response, '"title": "My Document"')
        # Invalid session key should have read permission.
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = 'bogus'
        response = self.app_client.get('/docs/MyDoc/')
        self.assertContains(response, '"title": "My Document"')
        # Anonymous should have read permission.
        del self.app_client.cookies[settings.SESSION_COOKIE_NAME]
        response = self.app_client.get('/docs/MyDoc/')
        self.assertContains(response, '"title": "My Document"')

    def test_write_permissions(self):
        """Test access control in document_put."""
        # Document owner should have write permission.
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.app)
        response = self.app_client.put('/docs/MyDoc/', '{}',
                                       content_type=settings.JSON_MIMETYPE)
        self.assertContains(response, '"statusText": "Saved"')
        # Other authenticated users should have write permission.
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.paul.generate_session_key(self.app)
        response = self.app_client.put('/docs/MyDoc/', '{}',
                                       content_type=settings.JSON_MIMETYPE)
        self.assertContains(response, '"statusText": "Saved"')
        # Invalid session key should return a helpful error message.
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = 'bogus'
        response = self.app_client.put('/docs/MyDoc/', '{}',
                                       content_type=settings.JSON_MIMETYPE)
        self.assertContains(
            response, "Invalid sessionkey cookie: Expected 4 parts.",
            status_code=403)
        # Anonymous should not have write permission.
        del self.app_client.cookies[settings.SESSION_COOKIE_NAME]
        response = self.app_client.put('/docs/MyDoc/', '{}',
                                       content_type=settings.JSON_MIMETYPE)
        self.assertContains(response, 'Access denied.', status_code=403)

    def test_404(self):
        """Test that missing document prevents blob access."""
        response = self.app_client.get('/docs/unknown/')
        self.assertContains(response, 'Document not found: myapp/unknown',
                            status_code=404)
        # Writing a blob under this document should fail.
        response = self.app_client.put('/docs/unknown/blob/', 'data',
                                       content_type='text/plain')
        self.assertContains(response, 'Document not found: myapp/unknown',
                            status_code=404)
        # Reading a blob under this document should fail.
        response = self.app_client.get('/docs/unknown/blob/')
        self.assertContains(response, 'Document not found: myapp/unknown',
                            status_code=404)

    def test_timestamped_mixin(self):
        """Timestamps and IP addresses should be updated automatically."""
        original = datetime.datetime
        try:
            datetime.datetime = Mock()
            datetime.datetime.now.return_value = original(
                2010, 5, 10, 11, 12, 13)
            self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
                self.peter.generate_session_key(self.app)
            self.app_client.defaults['REMOTE_ADDR'] = '10.11.12.13'
            response = self.app_client.put(
                '/docs/foo/', '{"title": "Created Document"}',
                content_type='text/plain')
            self.assertContains(response, 'Saved')
            entity = Doc.get_by_key_name('myapp/foo')
            self.assertEqual(entity.title, 'Created Document')
            self.assertEqual(entity.created_ip, '10.11.12.13')
            self.assertEqual(entity.modified_ip, '10.11.12.13')
            self.assertEqual(entity.created.isoformat(),
                             '2010-05-10T11:12:13')
            self.assertEqual(entity.modified.isoformat(),
                             '2010-05-10T11:12:13')
            # Update same entity from a different IP address.
            datetime.datetime.now.return_value = original(
                2010, 5, 10, 11, 12, 14)
            self.app_client.defaults['REMOTE_ADDR'] = '10.11.12.14'
            response = self.app_client.put(
                '/docs/foo/', '{"title": "Modified Document"}',
                content_type='text/plain')
            self.assertContains(response, 'Saved')
            entity = Doc.get_by_key_name('myapp/foo')
            self.assertEqual(entity.title, 'Modified Document')
            self.assertEqual(entity.created_ip, '10.11.12.13')
            self.assertEqual(entity.modified_ip, '10.11.12.14')
            self.assertEqual(entity.created.isoformat(),
                             '2010-05-10T11:12:13')
            self.assertEqual(entity.modified.isoformat(),
                             '2010-05-10T11:12:14')
        finally:
            datetime.datetime = original
