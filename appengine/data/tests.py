from django.test import TestCase


class ClientTest(TestCase):

    def test_redirect(self):
        """Tests that a slash is appended to the URL if required."""
        response = self.client.get('/data')
        self.assertRedirects(response, '/data/', status_code=301)

    def test_index(self):
        """Tests that the data overview page loads."""
        response = self.client.get('/data/')
        self.assertEqual(response.status_code, 200)

    def test_demo(self):
        """Tests that the data demo page loads."""
        response = self.client.get('/data/demo/')
        self.assertEqual(response.status_code, 200)

    def test_get_404(self):
        """Tests that non-existent data returns 404 Not Found."""
        response = self.client.get('/data/does_not_exist/')
        self.assertEqual(response.status_code, 404)

    def test_post_not_allowed(self):
        """Tests that POST request returns 405 Method Not Allowed."""
        response = self.client.post('/data/key')
        self.assertEqual(response.status_code, 405)
