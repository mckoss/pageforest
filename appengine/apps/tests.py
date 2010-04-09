from django.test import TestCase

from google.appengine.ext import db

from apps.models import App


class CacheableTest(TestCase):

    def setUp(self):
        self.chess = App(key_name='chess')
        self.chat = App(key_name='chat')
        self.chat.put()

    def test_get_by_key_name(self):
        """Test that get_by_key_name uses the class cache."""
        # Create cache attribute on the App class.
        self.assertFalse(hasattr(App, 'cache'))
        app = App.get_by_key_name('unknown')
        self.assertEqual(app, None)
        self.assertTrue(hasattr(App, 'cache'))
        # Get existing app from datastore.
        app = App.get_by_key_name('chat')
        self.assertEqual(app.key().name(), 'chat')
        # Try to get an app that's not in datastore.
        app = App.get_by_key_name('chess')
        self.assertEqual(app, None)
        # Put chess in the App cache and try again.
        App.cache['chess'] = self.chess
        app = App.get_by_key_name('chess')
        self.assertEqual(app.key().name(), 'chess')
