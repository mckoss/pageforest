import re
import logging

from datetime import datetime

from django.conf import settings
from django.test import TestCase, Client

from auth.models import User
from apps.models import App
from docs.models import Doc
from blobs.models import Blob

from apps.middleware import app_id_from_trusted_domain

TAG_REGEX = re.compile(r'<[/!\w][^>]*>')


class AuthClient(Client):
    """
    Test client with AJAX request authentication support.
    """

    def add_auth_headers(self, url, headers):
        # request_id = crypto.random64(8)
        # headers['HTTP_X_REQUEST_ID'] = request_id
        # headers['HTTP_AUTHORIZATION'] = 'PF1 ' + crypto.hmac_sha1(
        #     url, request_id, secret)
        if hasattr(self, 'session_key') and self.session_key:
            headers['HTTP_AUTHORIZATION'] = 'PFSK1 ' + self.session_key

    def head(self, url, *args, **kwargs):
        self.add_auth_headers(url, kwargs)
        return super(AuthClient, self).head(url, *args, **kwargs)

    def get(self, url, *args, **kwargs):
        self.add_auth_headers(url, kwargs)
        return super(AuthClient, self).get(url, *args, **kwargs)

    def put(self, url, *args, **kwargs):
        self.add_auth_headers(url, kwargs)
        return super(AuthClient, self).put(url, *args, **kwargs)

    def delete(self, url, *args, **kwargs):
        self.add_auth_headers(url, kwargs)
        return super(AuthClient, self).delete(url, *args, **kwargs)

    def post(self, url, *args, **kwargs):
        self.add_auth_headers(url, kwargs)
        return super(AuthClient, self).post(url, *args, **kwargs)

    def options(self, url, *args, **kwargs):
        self.add_auth_headers(url, kwargs)
        return super(AuthClient, self).options(url, *args, **kwargs)


class AppTestCase(TestCase):
    """
    Reusable TestCase with automatic users, apps, documents.
    """

    def setUp(self):
        self.start_time = datetime.now()
        # Create some users.
        self.peter = User(key_name='peter', username='Peter',
                          email_verified=datetime.now())
        self.peter.set_password('peter_secret')
        self.peter.put()
        self.paul = User(key_name='paul', username='Paul')
        self.paul.set_password('paul_secret')
        self.paul.put()
        # Create a test application.
        self.www = App.lookup('www')
        self.app = App(
            key_name='myapp',
            title='My Test App',
            url='http://myapp.pageforest.com/',
            owner='peter',
            readers=['public'],
            tags=['mytag', '_featured'],
            secret="myapp_secret")
        self.app.put()
        # Create a test document.
        self.doc = Doc(
            key_name='myapp/mydoc',
            doc_id='MyDoc',
            title="My Document",
            tags='one two three'.split(),
            owner='peter',
            readers=['public'])
        self.doc.put()
        # Create some test blobs.
        Blob(key_name='apps/myapp/index.html/', value='<html>').put()
        Blob(key_name='myapp/mydoc/', value='{"int": 123}').put()
        self.blob = Blob(key_name='myapp/mydoc/myblob/', value='["json"]')
        self.blob.put()
        # Create test clients for www and app.
        self.www_client = Client(
            HTTP_HOST='www.pageforest.com',
            HTTP_REFERER='http://www.pageforest.com/')
        self.app_client = AuthClient(
            HTTP_HOST='myapp.pageforest.com',
            HTTP_REFERER='http://myapp.pageforest.com/')
        self.admin_client = AuthClient(
            HTTP_HOST='%s.myapp.pageforest.com' % settings.ADMIN_SUBDOMAIN,
            HTTP_REFERER='http://myapp.pageforest.com/')

    def sign_in(self, user):
        """
        Generate sessionkey cookies for this user.
        """
        self.www_client.cookies[settings.SESSION_COOKIE_NAME] = \
            user.generate_session_key(self.www)
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.app_client.session_key = \
            user.generate_session_key(self.app)
        self.admin_client.session_key = user.generate_session_key(
            self.app, subdomain=settings.ADMIN_SUBDOMAIN)

    def sign_out(self):
        """
        Remove sessionkey cookies.
        """
        if settings.SESSION_COOKIE_NAME in self.www_client.cookies:
            del self.www_client.cookies[settings.SESSION_COOKIE_NAME]
        if settings.SESSION_COOKIE_NAME in self.app_client.cookies:
            del self.app_client.cookies[settings.SESSION_COOKIE_NAME]

    def extract_content(self, response):
        """Extract the most meaningful parts from the response."""
        text = TAG_REGEX.sub(' ', response.content)
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return '\n'.join(lines[:20])

    def assertContains(self, response, *args, **kwargs):
        """Show the response if the test fails."""
        try:
            super(AppTestCase, self).assertContains(response, *args, **kwargs)
        except:
            logging.error(self.extract_content(response))
            raise

    def assertRedirects(self, response, *args, **kwargs):
        """Show the response if the test fails."""
        try:
            super(AppTestCase, self).assertRedirects(response, *args, **kwargs)
        except:
            logging.error(self.extract_content(response))
            raise


class AppJsonTest(AppTestCase):

    def test_app_json_update(self):
        """HTTP PUT app.json should update meta info."""
        url = '/app.json'
        self.sign_in(self.peter)
        response = self.admin_client.put(url, """\
{
"title": "My Application",
"tags": ["test", "myapp"]
}
""", content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        # Retrieve updated meta info.
        response = self.admin_client.get(url)
        self.assertContains(response, '"title": "My Application"')
        self.assertContains(response, '"tags": [\n    "test",\n    "myapp"')

    def test_app_json_get_auth(self):
        """The app_json_get view function should check read permissions."""
        url = '/app.json'
        self.app.readers = []
        self.app.put()
        # Application owner should have read permission.
        self.admin_client.session_key = self.peter.generate_session_key(
            self.app, subdomain=settings.ADMIN_SUBDOMAIN)
        response = self.admin_client.get(url)
        self.assertContains(response, '"url": "http://myapp.pageforest.com/"')
        # Session key for other subdomain should not have read permission.
        self.admin_client.session_key = \
            self.peter.generate_session_key(self.app, subdomain='docs')
        response = self.admin_client.get(url)
        self.assertContains(response, "Different subdomain.", status_code=403)
        # Session key without subdomain should not have read permission.
        self.admin_client.session_key = \
            self.peter.generate_session_key(self.app)
        response = self.admin_client.get(url)
        self.assertContains(response, "Missing subdomain.", status_code=403)
        # Other users should not have read permission.
        self.admin_client.session_key = self.paul.generate_session_key(
            self.app, subdomain=settings.ADMIN_SUBDOMAIN)
        response = self.admin_client.get(url)
        self.assertContains(response, "Read permission denied.",
                            status_code=403)
        # Invalid session key should return a helpful error message.
        self.admin_client.session_key = 'bogus'
        response = self.admin_client.get(url)
        self.assertContains(
            response, "Invalid sessionkey cookie: Expected 4 parts.",
            status_code=403)
        # Anonymous should not have read permission.
        self.admin_client.session_key = None
        response = self.admin_client.get(url)
        self.assertContains(response, "Read permission denied.",
                            status_code=403)

    def test_app_json_put_auth(self):
        """The app_json_put view function should check write permissions."""
        url = '/app.json'
        # Application owner should have write permission.
        self.admin_client.session_key = self.peter.generate_session_key(
            self.app, subdomain=settings.ADMIN_SUBDOMAIN)
        response = self.admin_client.put(url, '{}', content_type='text/plain')
        self.assertContains(response, '"statusText": "Saved"')
        # Session key for other subdomain should not have write permission.
        self.admin_client.session_key = self.peter.generate_session_key(
            self.app, subdomain=settings.ADMIN_SUBDOMAIN + 's')
        response = self.admin_client.put(url, '{}', content_type='text/plain')
        self.assertContains(response, "Different subdomain.", status_code=403)
        # Session key without subdomain should not have write permission.
        self.admin_client.session_key = \
            self.peter.generate_session_key(self.app)
        response = self.admin_client.put(url, '{}', content_type='text/plain')
        self.assertContains(response, "Missing subdomain.", status_code=403)
        # Other users should not have write permission.
        self.admin_client.session_key = self.paul.generate_session_key(
            self.app, subdomain=settings.ADMIN_SUBDOMAIN)
        response = self.admin_client.put(url, '{}', content_type='text/plain')
        self.assertContains(response, "Write permission denied.",
                            status_code=403)
        # Invalid session key should return a helpful error message.
        self.admin_client.session_key = 'bogus'
        response = self.admin_client.put(url, '{}', content_type='text/plain')
        self.assertContains(
            response, "Invalid sessionkey cookie: Expected 4 parts.",
            status_code=403)
        # Anonymous should not have write permission.
        self.admin_client.session_key = None
        response = self.admin_client.put(url, '{}', content_type='text/plain')
        self.assertContains(response, "Write permission denied.",
                            status_code=403)

    def test_app_json_put_tags(self):
        """The app_json_put view function should update non-reserved tags."""
        self.admin_client.session_key = self.peter.generate_session_key(
            self.app, subdomain=settings.ADMIN_SUBDOMAIN)
        self.assertEquals(
            App.get_by_key_name('myapp').tags, ['mytag', '_featured'])
        self.admin_client.put(
            '/app.json', '{"tags": ["newtag", "_ignorethis"]}',
            content_type='application/json')
        self.assertEquals(
            App.get_by_key_name('myapp').tags, ['newtag', '_featured'])


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
