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
            '/docs/mydoc',
            '/docs/MyDoc',
            '/docs/mydoc/',
            '/docs/MyDoc/',
            ]:
            response = self.app_client.post(url, {'key': 'value'})
            self.assertEqual(response.status_code, 405)
            self.assertEqual(response['Allow'], 'GET, LIST, PUT')

    def test_json(self):
        """Test JSON serializer for document."""
        response = self.app_client.get('/docs/MyDoc/')
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
        response = self.app_client.get('/docs/mydoc')
        self.assertEqual(response.content, canonical_content)
        response = self.app_client.get('/docs/MYDOC')
        self.assertEqual(response.content, canonical_content)

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


class PermissionTest(AppTestCase):

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
        self.doc.writers = ['authenticated']
        self.doc.put()
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
        self.assertContains(response, "Write permission denied.",
                            status_code=403)


class TimestampedTest(AppTestCase):

    def setUp(self):
        super(TimestampedTest, self).setUp()
        self.datetime = datetime.datetime
        datetime.datetime = Mock()

    def tearDown(self):
        datetime.datetime = self.datetime

    def test_timestamped_mixin(self):
        """Timestamps and IP addresses should be updated automatically."""
        datetime.datetime.now.return_value = \
            self.datetime(2010, 5, 10, 11, 12, 13)
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
        self.assertEqual(entity.created.isoformat(), '2010-05-10T11:12:13')
        self.assertEqual(entity.modified.isoformat(), '2010-05-10T11:12:13')
        # Update same entity from a different IP address.
        datetime.datetime.now.return_value = \
            self.datetime(2010, 5, 10, 11, 12, 14)
        self.app_client.defaults['REMOTE_ADDR'] = '10.11.12.14'
        response = self.app_client.put(
            '/docs/foo/', '{"title": "Modified Document"}',
            content_type='text/plain')
        self.assertContains(response, 'Saved')
        entity = Doc.get_by_key_name('myapp/foo')
        self.assertEqual(entity.title, 'Modified Document')
        self.assertEqual(entity.created_ip, '10.11.12.13')
        self.assertEqual(entity.modified_ip, '10.11.12.14')
        self.assertEqual(entity.created.isoformat(), '2010-05-10T11:12:13')
        self.assertEqual(entity.modified.isoformat(), '2010-05-10T11:12:14')
