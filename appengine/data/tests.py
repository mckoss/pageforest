from django.test import TestCase


class ClientTest(TestCase):

    def test_redirect(self):
        """Append a slash to the URL with permanent redirect."""
        response = self.client.get('/data')
        self.assertRedirects(response, '/data/', status_code=301)

    def test_index(self):
        """Load data overview page."""
        response = self.client.get('/data/')
        self.assertEqual(response.status_code, 200)

    def test_demo(self):
        """Load data demo page."""
        response = self.client.get('/data/demo/')
        self.assertEqual(response.status_code, 200)

    def test_get_404(self):
        """GET some data."""
        response = self.client.get('/data/does_not_exist/')
        self.assertEqual(response.status_code, 404)

    def test_post_not_allowed(self):
        """POST request is not allowed."""
        response = self.client.post('/data/key')
        self.assertEqual(response.status_code, 405)
