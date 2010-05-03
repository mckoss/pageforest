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

    def test_dummy_app(self):
        """Test that get_by_key_name uses memcache."""
        # Create a dummy app if it doesn't exist.
        app = App.get_by_hostname('unknown.pageforest.com')
        self.assertFalse(app.is_saved())
        self.assertEqual(app.title, 'Unknown')
        self.assertEqual(app.domains, ['unknown.pageforest.com'])
