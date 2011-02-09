import datetime
import logging

from django.conf import settings
from django.utils import simplejson as json

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
            self.assertEqual(response['Allow'], 'DELETE, GET, LIST, PUT')

    def test_json(self):
        """Test JSON serializer for document."""
        response = self.app_client.get('/docs/MyDoc/')
        self.assertEqual(response['ETag'][0], '"')
        self.assertEqual(response['ETag'][-1], '"')
        self.assertEqual(len(response['ETag']), 42)
        self.assertContains(response, '"docid": "MyDoc"')
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

    def test_delete(self):
        """Document deletion and tombstones."""
        self.sign_in(self.peter)

        # Verify doc and blobs can be read
        for url in ['/docs/mydoc', '/docs/mydoc/myblob']:
            response = self.app_client.get(url)
            self.assertEqual(response.status_code, 200)
        response = self.app_client.put('/docs/mydoc/child1', '', content_type='text')
        self.assertEqual(response.status_code, 200)
        response = self.app_client.get('/docs?method=list')
        self.assertEqual(response.status_code, 200)
        result = json.loads(response.content)
        self.assertEqual(len(result['items']), 1, response.content)
        self.assertEqual(response.status_code, 200)
        response = self.app_client.get('/docs/mydoc?method=list')
        self.assertEqual(response.status_code, 200)
        blobs = self.doc.all_blobs().fetch(100)
        self.assertEqual(len(blobs), 3, [blob.key().name() for blob in blobs])

        # Simulate tombstone - hiding doc and child blobs
        self.doc.deleted = True
        self.doc.put()
        for url in ['/docs/mydoc', '/docs/mydoc/myblob']:
            response = self.app_client.get(url)
            self.assertEqual(response.status_code, 404, url)
        response = self.app_client.get('/docs?method=list')
        self.assertEqual(response.status_code, 200)
        result = json.loads(response.content)
        self.assertEqual(len(result['items']), 0, response.content)
        response = self.app_client.get('/docs/mydoc?method=list')
        self.assertEqual(response.status_code, 404)
        response = self.app_client.put('/docs/mydoc/child2', '', content_type='text')
        self.assertEqual(response.status_code, 404)

        blobs = self.doc.all_blobs().fetch(100)
        self.assertEqual(len(blobs), 3)
        self.doc.delete()
        blobs = self.doc.all_blobs().fetch(100)
        self.assertEqual(len(blobs), 0)


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
        self.assertContains(response,
                            '"isoformat": "2010-11-12T13:14:15Z')
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

    def test_timestamped_mixin(self):
        """Timestamps and IP addresses should be updated automatically."""
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.app)
        self.app_client.defaults['REMOTE_ADDR'] = '10.11.12.13'
        response = self.app_client.put(
            '/docs/foo/', '{"title": "Created Document"}',
            content_type='text/plain')
        self.assertContains(response, 'Created', status_code=201)
        entity = Doc.get_by_key_name('myapp/foo')
        self.assertEqual(entity.title, 'Created Document')
        self.assertEqual(entity.created_ip, '10.11.12.13')
        self.assertEqual(entity.modified_ip, '10.11.12.13')
        self.assertEqual(entity.created.isoformat(), '2010-11-12T13:14:15')
        self.assertEqual(entity.modified.isoformat(), '2010-11-12T13:14:15')
        # Update same entity from a different IP address.
        datetime.datetime.advance_time(1)
        self.app_client.defaults['REMOTE_ADDR'] = '10.11.12.14'
        response = self.app_client.put(
            '/docs/foo/', '{"title": "Modified Document"}',
            content_type='text/plain')
        self.assertContains(response, 'Saved')
        entity = Doc.get_by_key_name('myapp/foo')
        self.assertEqual(entity.title, 'Modified Document')
        self.assertEqual(entity.created_ip, '10.11.12.13')
        self.assertEqual(entity.modified_ip, '10.11.12.14')
        self.assertEqual(entity.created.isoformat(), '2010-11-12T13:14:15')
        self.assertEqual(entity.modified.isoformat(), '2010-11-12T13:14:16')


class HashableTest(AppTestCase):

    def test_is_hashed(self):
        self.assertTrue(hasattr(self.doc, 'sha1'))
        self.assertTrue(hasattr(self.doc, 'size'))
        self.assertTrue(self.doc.size > 5, self.doc.size)
