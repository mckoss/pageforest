from google.appengine.api import memcache

from django.test import TestCase

from hosting.models import Document


class ClientTest(TestCase):

    def test_get_404(self):
        """Tests that non-existent data returns 404 Not Found."""
        response = self.client.get('/does_not_exist.html')
        self.assertEqual(response.status_code, 404)

    def test_post_not_allowed(self):
        """Tests that POST request returns 405 Method Not Allowed."""
        response = self.client.post('/index.html')
        self.assertEqual(response.status_code, 405)


class RestApiTest(TestCase):

    def test_crud(self):
        """Tests create, read, update, delete with REST API."""
        key_name = 'test/index.html'
        self.assertEqual(Document.get_by_key_name(key_name), None)
        # Create.
        response = self.client.put('/index.html', 'html',
                                   content_type='text/html')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'saved')
        self.assertEqual(Document.get_by_key_name(key_name).content, 'html')
        # Read.
        response = self.client.get('/index.html')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'html')
        # Read again, with implicit filename.
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'html')
        # Update.
        response = self.client.put('/index.html', 'updated',
                                   content_type='text/html')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'saved')
        self.assertEqual(Document.get_by_key_name(key_name).content, 'updated')
        # Delete.
        response = self.client.delete('/index.html')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, 'deleted')
        self.assertEqual(Document.get_by_key_name(key_name), None)
