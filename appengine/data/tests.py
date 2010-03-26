from google.appengine.api import memcache

from django.test import TestCase

from data.models import KeyValue


class ClientTest(TestCase):

    def test_get_404(self):
        """Tests that non-existent data returns 404 Not Found."""
        response = self.client.get('/data/does_not_exist/')
        self.assertEqual(response.status_code, 404)

    def test_post_not_allowed(self):
        """Tests that POST request returns 405 Method Not Allowed."""
        response = self.client.post('/data/key')
        self.assertEqual(response.status_code, 405)


class RestApiTest(TestCase):

    def test_crud(self):
        """Tests create, read, update, delete with REST API."""
        key_name = 'test/data/entity'
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)
        # Create.
        response = self.client.put('/data/entity', 'data',
                                   content_type='text/plain')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'saved')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.client.get('/data/entity')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'data')
        # Update.
        response = self.client.put('/data/entity', 'updated',
                                   content_type='text/plain')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'saved')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.client.delete('/data/entity')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'deleted')
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)


class JsonpApiTest(TestCase):

    def test_crud(self):
        """Tests create, read, update, delete with JSONP API."""
        key_name = 'test/data/entity'
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)
        # Create.
        response = self.client.get('/data/entity?method=PUT&value=data')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'saved')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'data')
        # Read.
        response = self.client.get('/data/entity')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'data')
        # Update.
        response = self.client.get('/data/entity?method=PUT&value=updated')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'saved')
        self.assertEqual(KeyValue.get_by_key_name(key_name).value, 'updated')
        # Delete.
        response = self.client.get('/data/entity?method=DELETE')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'deleted')
        self.assertEqual(KeyValue.get_by_key_name(key_name), None)


class MemcacheTest(TestCase):

    def test_crud(self):
        """Tests create, read, update, delete with memcache."""
        key_name = 'test/data/entity'
        self.assertEqual(memcache.get(key_name), None)
        # Create.
        self.client.put('/data/entity', 'data', content_type='text/plain')
        self.assertEqual(memcache.get(key_name)[26:], 'GMT|data')
        # Make sure it reads from memcache if possible.
        last_modified = 'Tue, 15 Nov 1994 12:45:26 GMT'
        memcache.set(key_name, last_modified + '|cached', 300)
        response = self.client.get('/data/entity')
        self.assertEqual(response.content, 'cached')
        self.assertEqual(response['Last-Modified'], last_modified)
        # Make sure that GET saves to memcache if necessary.
        memcache.delete(key_name)
        self.assertEqual(memcache.get(key_name), None)
        response = self.client.get('/data/entity')
        self.assertEqual(memcache.get(key_name)[26:], 'GMT|data')
        # Update.
        self.client.put('/data/entity', 'updated', content_type='text/plain')
        self.assertEqual(memcache.get(key_name)[26:], 'GMT|updated')
        # Delete.
        self.client.delete('/data/entity')
        self.assertEqual(memcache.get(key_name), None)


class MimeTest(TestCase):

    def test_html(self):
        """Test that the mime type is guessed correctly for HTML."""
        self.client.put('/index.html', 'text', content_type='text/plain')
        response = self.client.get('/')
        self.assertEqual(response['Content-Type'], 'text/html')
        response = self.client.get('/index.html')
        self.assertEqual(response['Content-Type'], 'text/html')

    def test_css(self):
        """Test that the mime type is guessed correctly for CSS."""
        self.client.put('/style.css', 'text', content_type='text/plain')
        response = self.client.get('/style.css')
        self.assertEqual(response['Content-Type'], 'text/css')

    def test_js(self):
        """Test that the mime type is guessed correctly for JS."""
        self.client.put('/test.js', 'text', content_type='text/plain')
        response = self.client.get('/test.js')
        self.assertEqual(response['Content-Type'], 'application/javascript')

    def test_json(self):
        """Test that the mime type is guessed correctly for JSON."""
        self.client.put('/data/test.json', 'text', content_type='text/plain')
        response = self.client.get('/data/test.json')
        self.assertEqual(response['Content-Type'], 'application/json')
