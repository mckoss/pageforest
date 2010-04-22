from datetime import datetime, timedelta

from google.appengine.api import memcache

from django.conf import settings
from django.test import TestCase
from django.test.client import Client

from auth.models import User
from apps.models import App

from utils import crypto


class UserTest(TestCase):

    def setUp(self):
        self.start_time = datetime.now()
        self.peter = User(key_name='peter', username='Peter')
        self.peter.put()
        self.paul = User(key_name='paul', username='Paul')
        self.paul.put()

    def test_random_salt(self):
        """Test that the same password generates different hashes."""
        self.peter.set_password('secret')
        self.paul.set_password('secret')
        self.assertNotEqual(self.peter.password, self.paul.password)

    def test_timestamps(self):
        """Test that the timestamps are properly set."""
        self.assertTrue(self.peter.date_joined >= self.start_time)
        self.assertTrue(self.peter.last_login >= self.start_time)
        self.assertTrue(self.paul.date_joined >= self.peter.date_joined)

    def test_migratable(self):
        """Test schema migration for User model."""

        def dummy_migrate(self, schema):
            """Set the migrated flag for this test."""
            self.migrated = schema

        # TODO: The following monkey patch might break other tests.
        User.migrate = dummy_migrate
        User.schema_current = 2
        self.peter.migrated = 0
        self.assertEqual(self.peter.schema, 1)
        self.peter.update_schema()
        self.assertEqual(self.peter.schema, 2)
        self.assertEqual(self.peter.migrated, 2)


class RegistrationTest(TestCase):

    def setUp(self):
        self.start_time = datetime.now()
        self.peter = User(key_name='peter',
                          username='Peter',
                          email='peter@example.com')
        self.peter.set_password('password')
        self.peter.put()
        self.www = Client(HTTP_HOST='www.pageforest.com')

    def test_username_invalid(self):
        """Test that invalid usernames are rejected."""
        for name in '_name a-b 0.5'.split():
            response = self.www.post('/auth/register/', {'username': name})
            self.assertContains(response, 'Username must be alphanumeric.')

    def test_username_too_long(self):
        """Test that excessively long usernames are rejected."""
        response = self.www.post('/auth/register/', {'username': 'a' * 31})
        self.assertContains(response,
            'Ensure this value has at most 30 characters (it has 31).')

    def test_username_reserved(self):
        """Test that reserved usernames are enforced."""
        for name in 'root admin test'.split():
            response = self.www.post('/auth/register/', {'username': name})
            self.assertContains(response, 'This username is reserved.')

    def test_password_silly(self):
        """Test that silly passwords are rejected."""
        for pw in '123456 aaaaaa qwerty qwertz mnbvcxz NBVCXY'.split():
            response = self.www.post('/auth/register/', {'password': pw})
            self.assertContains(response, 'This password is too simple.')

    def test_username_taken(self):
        """Test that existing usernames are reserved."""
        response = self.www.post('/auth/register/', {'username': 'peter'})
        self.assertContains(response, 'This username is already taken.')


class LoginTest(TestCase):

    def setUp(self):
        self.peter = User(key_name='peter', username='Peter')
        self.peter.set_password('SecreT!1')
        self.peter.put()
        self.app = App(key_name='myapp', domains=['myapp.pageforest.com'],
                       secret=crypto.random64())
        self.app.put()
        self.auth = Client(HTTP_HOST='auth.' + self.app.domains[0])

    def test_login(self):
        """Test challenge and login."""
        # Get a challenge from the server.
        response = self.auth.get('/challenge/')
        self.assertContains(response, '$201')
        challenge = response.content
        self.assertEqual(len(challenge), 94)
        # Sign the challenge and attempt login.
        signed = crypto.sign(challenge, self.peter.password)
        data = crypto.join(self.peter.username.lower(), signed)
        response = self.auth.post('/login/', data, content_type='text/plain')
        self.assertContains(response, 'myapp$peter$201')
        cookie = response['Set-Cookie']
        self.assertTrue(cookie.startswith('reauth=myapp$peter$201'))
        self.assertTrue(cookie.endswith(' GMT'))
        self.assertTrue('; path=/; expires=' in cookie)

    def test_bogus_login(self):
        """Test that a bogus authentication string cannot login."""
        response = self.auth.post('/login/', 'x', content_type='text/plain')
        self.assertContains(response, 'Authentication must have five parts.',
                            status_code=403)

    def test_expired_challenge(self):
        """Test that an expired challenge stops working."""
        challenge = self.auth.get('/challenge/').content
        parts = challenge.split(crypto.SEPARATOR)
        parts[1] = datetime.strptime(parts[1], "%Y-%m-%dT%H:%M:%SZ")
        parts[1] -= timedelta(seconds=61)
        challenge = crypto.join(parts)
        signed = crypto.sign(challenge, self.peter.password)
        data = crypto.join(self.peter.username.lower(), signed)
        response = self.auth.post('/login/', data, content_type='text/plain')
        self.assertContains(response, 'The challenge is expired.',
                            status_code=403)

    def test_replay(self):
        """Test that a replay attack cannot login."""
        challenge = self.auth.get('/challenge/').content
        signed = crypto.sign(challenge, self.peter.password)
        data = crypto.join(self.peter.username.lower(), signed)
        # First login should be successful.
        response = self.auth.post('/login/', data, content_type='text/plain')
        self.assertContains(response, 'myapp$peter$201')
        # Replay should fail with 403 Forbidden.
        response = self.auth.post('/login/', data, content_type='text/plain')
        self.assertContains(response, 'The challenge is unknown.',
                            status_code=403)

    def test_different_ip(self):
        """Test that different IP address cannot login."""
        challenge = self.auth.get('/challenge/').content
        memcache.set(challenge, '10.4.5.6', 60)
        signed = crypto.sign(challenge, self.peter.password)
        data = crypto.join('unknown', signed)
        response = self.auth.post('/login/', data, content_type='text/plain')
        self.assertContains(response,
                            "The challenge was issued to a different IP.",
                            status_code=403)

    def test_unknown_user(self):
        """Test that unknown user cannot login."""
        challenge = self.auth.get('/challenge/').content
        signed = crypto.sign(challenge, self.peter.password)
        data = crypto.join('unknown', signed)
        response = self.auth.post('/login/', data, content_type='text/plain')
        self.assertContains(response, "The username 'unknown' is unknown.",
                            status_code=403)

    def test_wrong_password(self):
        """Test that incorrect password cannot login."""
        challenge = self.auth.get('/challenge/').content
        signed = crypto.sign(challenge, self.peter.password[::-1])
        data = crypto.join(self.peter.username.lower(), signed)
        response = self.auth.post('/login/', data, content_type='text/plain')
        self.assertContains(response, 'The password signature is incorrect.',
                            status_code=403)


class SimpleAuthTest(TestCase):

    def setUp(self):
        self.peter = User(key_name='peter', username='Peter',
                          email='peter@example.com')
        self.peter.set_password('password')
        self.peter.put()
        self.app = App(key_name='myapp', domains=['myapp.pageforest.com'],
                       secret=crypto.random64())
        self.app.put()
        self.auth = Client(HTTP_HOST='auth.' + self.app.domains[0])
        challenge = self.auth.get('/challenge/').content
        signed = crypto.sign(challenge, self.peter.password)
        data = crypto.join(self.peter.username, signed)
        self.session_key = self.auth.post(
            '/login/', data, content_type='text/plain').content
        self.app_client = Client(HTTP_HOST=self.app.domains[0])

    def test_bogus_session_key(self):
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = 'bogus'
        response = self.app_client.get('/doc/')
        self.assertContains(response, "Session key must have four parts.",
                            status_code=403)
        session_key = crypto.join(self.session_key, 'bogus')
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        response = self.app_client.get('/doc/')
        self.assertContains(response, "Session key must have four parts.",
                            status_code=403)

    def test_session_key_expired(self):
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[2] = datetime.now() - timedelta(seconds=10)
        session_key = crypto.join(parts)
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        response = self.app_client.get('/doc/')
        self.assertContains(response, "Session key is expired.",
                            status_code=403)

    def test_different_app(self):
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[0] = 'other'
        session_key = crypto.join(parts)
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        response = self.app_client.get('/doc/')
        self.assertContains(response, "Session key is for a different app.",
                            status_code=403)

    def test_unknown_user(self):
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[1] = 'unknown'
        session_key = crypto.join(parts)
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        response = self.app_client.get('/doc/')
        self.assertContains(response, "Session key user not found.",
                            status_code=403)

    def test_incorrect_session_key(self):
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[-1] = parts[-1][::-1]  # Backwards.
        session_key = crypto.join(parts)
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        response = self.app_client.get('/doc/')
        self.assertContains(response, "Session key is incorrect.",
                            status_code=403)
