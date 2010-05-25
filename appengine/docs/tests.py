import datetime
from mock import Mock

from django.conf import settings

from apps.tests import AppTestCase

from docs.models import Doc


class DocumentTest(AppTestCase):

    def test_get_absolute_url(self):
        """Test that the absolute URL is generated correctly."""
        self.assertEqual(self.doc.get_absolute_url(),
                         'http://myapp.pageforest.com/#MyDoc')

    def test_http_method_not_allowed(self):
        """The /doc_id/ URL should report allowed methods."""
        self.sign_in(self.peter)
        for url in [
            '/mydoc',
            '/MyDoc',
            '/mydoc/',
            '/MyDoc/',
            ]:
            response = self.docs_client.post(url, {'key': 'value'})
            self.assertEqual(response.status_code, 405)
            self.assertEqual(response['Allow'], 'GET, LIST, PUT')

    def test_json(self):
        """Test JSON serializer for document."""
        response = self.docs_client.get('/MyDoc/')
        self.assertContains(response, '"doc_id": "MyDoc"')
        self.assertContains(response, '"title": "My Document"')
        self.assertContains(response, '"readers": [\n    "public"\n  ]')
        self.assertContains(response, '"writers": []')
        self.assertContains(response,
            '"tags": [\n    "one",\n    "two",\n    "three"\n  ]')
        self.assertContains(response,
            '"created": {\n    "__class__": "Date",\n    "isoformat": "201')
        self.assertContains(response,
            '"modified": {\n    "__class__": "Date",\n    "isoformat": "201')
        self.assertContains(response, '"blob": {\n    "int": 123\n  }')
        # Check that hidden properties are not visible.
        self.assertNotContains(response, '"schema":')
        self.assertNotContains(response, '"created_ip":')
        self.assertNotContains(response, '"modified_ip":')
        # Check that the document ID is case insensitive.
        canonical_content = response.content
        response = self.docs_client.get('/mydoc')
        self.assertEqual(response.content, canonical_content)
        response = self.docs_client.get('/MYDOC')
        self.assertEqual(response.content, canonical_content)

    def test_read_permissions(self):
        """Test access control in document_get."""
        # Document owner should have read permission.
        self.docs_client.session_key = \
            self.peter.generate_session_key(self.app)
        response = self.docs_client.get('/MyDoc/')
        self.assertContains(response, '"title": "My Document"')
        # Other users should have read permission.
        self.docs_client.session_key = \
            self.paul.generate_session_key(self.app)
        response = self.docs_client.get('/MyDoc/')
        self.assertContains(response, '"title": "My Document"')
        # Invalid session key should have read permission.
        self.docs_client.session_key = 'bogus'
        response = self.docs_client.get('/MyDoc/')
        self.assertContains(response, '"title": "My Document"')
        # Anonymous should have read permission.
        del self.docs_client.session_key
        response = self.docs_client.get('/MyDoc/')
        self.assertContains(response, '"title": "My Document"')

    def test_write_permissions(self):
        """Test access control in document_put."""
        self.doc.writers = ['authenticated']
        self.doc.put()
        # Document owner should have write permission.
        self.docs_client.session_key = \
            self.peter.generate_session_key(self.app)
        response = self.docs_client.put('/MyDoc/', '{}',
                                       content_type=settings.JSON_MIMETYPE)
        self.assertContains(response, '"statusText": "Saved"')
        # Other authenticated users should have write permission.
        self.docs_client.session_key = \
            self.paul.generate_session_key(self.app)
        response = self.docs_client.put('/MyDoc/', '{}',
                                       content_type=settings.JSON_MIMETYPE)
        self.assertContains(response, '"statusText": "Saved"')
        # Invalid session key should return a helpful error message.
        self.docs_client.session_key = 'bogus'
        response = self.docs_client.put('/MyDoc/', '{}',
                                       content_type=settings.JSON_MIMETYPE)
        self.assertContains(
            response, "Invalid sessionkey cookie: Expected 4 parts.",
            status_code=403)
        # Anonymous should not have write permission.
        del self.docs_client.session_key
        response = self.docs_client.put('/MyDoc/', '{}',
                                       content_type=settings.JSON_MIMETYPE)
        self.assertContains(response, "Write permission denied.",
                            status_code=403)

    def test_404(self):
        """Test that missing document prevents blob access."""
        response = self.docs_client.get('/unknown/')
        self.assertContains(response, 'Document not found: myapp/unknown',
                            status_code=404)
        # Writing a blob under this document should fail.
        response = self.docs_client.put('/unknown/blob/', 'data',
                                       content_type='text/plain')
        self.assertContains(response, 'Document not found: myapp/unknown',
                            status_code=404)
        # Reading a blob under this document should fail.
        response = self.docs_client.get('/unknown/blob/')
        self.assertContains(response, 'Document not found: myapp/unknown',
                            status_code=404)

    def test_timestamped_mixin(self):
        """Timestamps and IP addresses should be updated automatically."""
        original = datetime.datetime
        try:
            datetime.datetime = Mock()
            datetime.datetime.now.return_value = original(
                2010, 5, 10, 11, 12, 13)
            self.docs_client.session_key = \
                self.peter.generate_session_key(self.app)
            self.docs_client.defaults['REMOTE_ADDR'] = '10.11.12.13'
            response = self.docs_client.put(
                '/foo/', '{"title": "Created Document"}',
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
            self.docs_client.defaults['REMOTE_ADDR'] = '10.11.12.14'
            response = self.docs_client.put(
                '/foo/', '{"title": "Modified Document"}',
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
