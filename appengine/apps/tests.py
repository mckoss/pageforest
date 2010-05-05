from django.test import TestCase

from apps.models import App


class HostnameTest(TestCase):

    def setUp(self):
        self.myapp = App(key_name='myapp', domains=['myapp.pageforest.com'])
        self.myapp.put()

    def test_get_by_hostname(self):
        """Test that get_by_hostname finds an existing app."""
        app = App.get_by_hostname('myapp.pageforest.com')
        self.assertEqual(app.key().name(), 'myapp')
        app = App.get_by_hostname('myapp.dev.latest.pageforest.appspot.com')
        self.assertEqual(app.key().name(), 'myapp')
        app = App.get_by_hostname('myapp.pgfr.st')
        self.assertEqual(app.key().name(), 'myapp')
        app = App.get_by_hostname('myapp.localhost')
        self.assertEqual(app.key().name(), 'myapp')
        self.assertTrue(app.is_saved())

    def test_unknown_app(self):
        """Test that unknown app is not found."""
        # Create a dummy app if it doesn't exist.
        app = App.get_by_hostname('unknown.pageforest.com')
        self.assertEqual(app, None)
