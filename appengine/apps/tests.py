from django.conf import settings
from django.test import TestCase, Client

from auth.models import User
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
        app = App.get_by_hostname('unknown.pageforest.com')
        self.assertEqual(app, None)


class AppErrorsTest(TestCase):
    def setUp(self):
        self.noapp_client = Client(HTTP_HOST="nosuch.pageforest.com")

    def test_missing_app(self):
        response = self.noapp_client.get('/')
        self.assertEqual(response.status_code, 404)


class AppJsonTest(TestCase):

    def setUp(self):
        self.peter = User(key_name='peter', username='Peter')
        self.peter.put()
        self.paul = User(key_name='paul', username='Paul')
        self.paul.put()
        self.app = App(key_name='myapp', domains=['myapp.pageforest.com'],
                         readers=['peter'], writers=['peter'])
        self.app.put()
        self.app_client = Client(HTTP_HOST=self.app.domains[0])
        self.www = App.lookup('www')
        self.www_client = Client(HTTP_HOST='www.pageforest.com')

    def test_auth_app_json_get(self):
        """Test access control in app_json_get."""
        url = '/apps/myapp/app.json'
        # Application owner should have read permission.
        self.www_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.www)
        response = self.www_client.get(url)
        self.assertContains(response, '"domains": ["myapp.pageforest.com"]')
        # Other users should not have read permission.
        self.www_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.paul.generate_session_key(self.www)
        response = self.www_client.get(url)
        self.assertContains(response, "Access denied.", status_code=403)
        # Invalid session key should return a helpful error message.
        self.www_client.cookies[settings.SESSION_COOKIE_NAME] = 'bogus'
        response = self.www_client.get(url)
        self.assertContains(
            response, "Invalid sessionkey cookie: Expected 4 parts.",
            status_code=403)
        # Anonymous should not have read permission.
        del self.www_client.cookies[settings.SESSION_COOKIE_NAME]
        response = self.www_client.get(url)
        self.assertContains(response, "Access denied.", status_code=403)

    def test_auth_app_json_put(self):
        """Test access control in app_json_put."""
        url = '/apps/myapp/app.json'
        # Application owner should have write permission.
        self.www_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.www)
        response = self.www_client.put(url, '{"title":"hi mom"}',
                                       content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        # Other users should not have write permission.
        self.www_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.paul.generate_session_key(self.www)
        response = self.www_client.put(url, '{}', content_type='text/plain')
        self.assertContains(response, "Access denied.", status_code=403)
        # Invalid session key should return a helpful error message.
        self.www_client.cookies[settings.SESSION_COOKIE_NAME] = 'bogus'
        response = self.www_client.put(url, '{}', content_type='text/plain')
        self.assertContains(
            response, "Invalid sessionkey cookie: Expected 4 parts.",
            status_code=403)
        # Anonymous should not have write permission.
        del self.www_client.cookies[settings.SESSION_COOKIE_NAME]
        response = self.www_client.put(url, '{}', content_type='text/plain')
        self.assertContains(response, "Access denied.", status_code=403)
