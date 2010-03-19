from django.test import TestCase


class ClientTest(TestCase):

    def test_redirect(self):
        """Append a slash to the URL with permanent redirect."""
        response = self.client.get('/data')
        self.assertRedirects(response, '/data/', status_code=301)

    def test_get_404(self):
        """GET some data."""
        response = self.client.get('/data/does_not_exist/')
        self.assertEqual(response.status_code, 404)
