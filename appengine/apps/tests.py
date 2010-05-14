from datetime import datetime

from django.conf import settings
from django.test import TestCase, Client

from auth.models import User
from apps.models import App
from apps.middleware import app_id_from_trusted_domain


class HostnameTest(TestCase):

    def test_trusted_domain(self):
        """The app_id_from_trusted_domain function should find myapp."""
        for hostname in [
            'myapp.pageforest.com',
            'myapp.pageforest.appspot.com',
            'myapp.dev.latest.pageforest.appspot.com',
            'myapp.2010-05-12.latest.pageforest.appspot.com',
            'myapp.pgfr.st',
            'myapp.pgfrst.com',
            'myapp.pageforest',
            'myapp.localhost',
            'myapp.localhost:8080',
            ]:
            self.assertEqual(app_id_from_trusted_domain(hostname), 'myapp')

    def test_unknown_domain(self):
        """Untrusted domains should return None."""
        for hostname in [
            'malicious.com',
            'www.malicious.com',
            'myapp.malicious.com',
            ]:
            self.assertEqual(app_id_from_trusted_domain(hostname), None)


class AppErrorsTest(TestCase):

    def setUp(self):
        self.noapp_client = Client(HTTP_HOST="nosuch.pageforest.com")

    def test_missing_app(self):
        """A missing app should return 404 Not Found."""
        response = self.noapp_client.get('/')
        self.assertEqual(response.status_code, 404)


class AppJsonTest(TestCase):

    def setUp(self):
        self.peter = User(key_name='peter', username='Peter',
                          email_verified=datetime.now())
        self.peter.put()
        self.paul = User(key_name='paul', username='Paul')
        self.paul.put()
        self.app = App(key_name='myapp', domains=['myapp.pageforest.com'],
                       readers=['peter'], writers=['peter'],
                       tags=['mytag', '_featured'])
        self.app.put()
        self.app_client = Client(HTTP_HOST=self.app.domains[0])
        self.www = App.lookup('www')
        self.www_client = Client(HTTP_HOST='www.pageforest.com')

    def test_app_json_update(self, app_id='myapp'):
        """HTTP PUT app.json should update meta info."""
        url = '/apps/%s/app.json' % app_id
        self.www_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.www)
        response = self.www_client.put(url, """\
{
"title": "My Application",
"tags": ["test", "myapp"]
}
""", content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        # Retrieve updated meta info.
        response = self.www_client.get(url)
        self.assertContains(response, '"title": "My Application"')
        self.assertContains(response, '"tags": [\n    "test",\n    "myapp"')

    def test_app_json_create(self):
        """HTTP PUT app.json should create an app if it didn't exist."""
        self.test_app_json_update(app_id='newapp')

    def test_app_json_get_auth(self):
        """The app_json_get view function should check read permissions."""
        url = '/apps/myapp/app.json'
        # Application owner should have read permission.
        self.www_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.www)
        response = self.www_client.get(url)
        self.assertContains(
            response, '"domains": [\n    "myapp.pageforest.com"\n  ]')
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

    def test_app_json_put_auth(self):
        """The app_json_put view function should check write permissions."""
        url = '/apps/myapp/app.json'
        # Application owner should have write permission.
        self.www_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.www)
        response = self.www_client.put(url, '{}', content_type='text/plain')
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

    def test_app_json_put_tags(self):
        """The app_json_put view function should update non-reserved tags."""
        url = '/apps/myapp/app.json'
        self.www_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.www)
        self.assertEquals(App.get_by_key_name('myapp').tags,
                          ['mytag', '_featured'])
        self.www_client.put(url, '{"tags": ["newtag", "_ignorethis"]}',
                            content_type='application/json')
        self.assertEquals(App.get_by_key_name('myapp').tags,
                          ['newtag', '_featured'])
