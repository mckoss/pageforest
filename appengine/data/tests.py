from google.appengine.api import memcache

from django.test import TestCase

from data.models import KeyValue


class ClientTest(TestCase):

    def test_redirect(self):
        """Tests that a slash is appended to the URL if required."""
        response = self.client.get('/data')
        self.assertRedirects(response, '/data/', status_code=301)

    def test_index(self):
        """Tests that the data overview page loads."""
        response = self.client.get('/data/')
        self.assertEqual(response.status_code, 200)

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
        key_name = 'test/entity'
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
        key_name = 'test/entity'
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
        key_name = 'test/entity'
        self.assertEqual(memcache.get(key_name), None)
        # Create.
        self.client.put('/data/entity', 'data', content_type='text/plain')
        self.assertEqual(memcache.get(key_name), 'data')
        # Make sure it reads from memcache if possible.
        memcache.set(key_name, 'cached', 300)
        response = self.client.get('/data/entity')
        self.assertEqual(response.content, 'cached')
        # Update.
        self.client.put('/data/entity', 'updated', content_type='text/plain')
        self.assertEqual(memcache.get(key_name), 'updated')
        # Delete.
        self.client.delete('/data/entity')
        self.assertEqual(memcache.get(key_name), None)
