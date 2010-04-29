from django.test import TestCase


class ClientTest(TestCase):

    # def test_redirect(self):
    #     """Tests that a slash is removed from the URL if required."""
    #     response = self.client.get('/dashboard/')
    #     self.assertRedirects(response, '/dashboard', status_code=301)

    def test_index(self):
        """Tests that the dashboard loads."""
        response = self.client.get('/dashboard')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<title>Dashboard')
