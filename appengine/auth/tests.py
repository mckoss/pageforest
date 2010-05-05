import time
from datetime import datetime

from django.conf import settings
from django.test import TestCase
from django.test.client import Client

from auth.models import User
from apps.models import App
from docs.models import Doc

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
        self.assertTrue(self.peter.created >= self.start_time)
        self.assertTrue(self.peter.last_login >= self.start_time)
        self.assertTrue(self.paul.created >= self.peter.created)

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

    def test_username_invalid_first(self):
        """Test that invalid usernames are rejected."""
        for char in '012_-.,!?$:@/':
            response = self.www.post(
                '/auth/sign-up', {'username': char + 'name'})
            self.assertContains(
                response, "Username must start with a letter.")

    def test_username_invalid_last(self):
        """Test that invalid usernames are rejected."""
        for char in '_-.,!?$:@/':
            response = self.www.post(
                '/auth/sign-up', {'username': 'name' + char})
            self.assertContains(
                response, "Username must end with a letter or number.")

    def test_username_invalid(self):
        """Test that invalid usernames are rejected."""
        for char in '_.,!?$:@/':
            response = self.www.post(
                '/auth/sign-up', {'username': 'a' + char + 'b'})
            self.assertContains(response,
                "Username must contain only letters, numbers and dashes.")

    def test_username_too_short(self):
        """Test that excessively short usernames are rejected."""
        response = self.www.post('/auth/sign-up', {'username': 'a'})
        self.assertContains(response, "at least 2 characters")

    def test_username_too_long(self):
        """Test that excessively long usernames are rejected."""
        response = self.www.post('/auth/sign-up', {'username': 'a' * 31})
        self.assertContains(response,
            "Ensure this value has at most 30 characters (it has 31).")

    def test_username_reserved(self):
        """Test that reserved usernames are enforced."""
        for name in 'root admin test'.split():
            response = self.www.post('/auth/sign-up', {'username': name})
            self.assertContains(response, "This username is reserved.")

    def test_password_silly(self):
        """Test that silly passwords are rejected."""
        for password in '123456 aaaaaa qwerty qwertz mnbvcxz NBVCXY'.split():
            response = self.www.post('/auth/sign-up', {'password': password})
            self.assertContains(response, "This password is too simple.")

    def test_username_taken(self):
        """Test that existing usernames are reserved."""
        response = self.www.post('/auth/sign-up', {'username': 'peter'})
        self.assertContains(response, "This username is already taken.")


class SignInTest(TestCase):
    def setUp(self):
        self.peter = User(key_name='peter',
                          username='Peter',
                          email='peter@example.com')
        self.peter.set_password('password')
        self.peter.put()
        self.www = Client(HTTP_HOST='www.pageforest.com')

    def test_errors(self):
        cases = ({'fields': {'username': '', 'password': ''},
                  'expect': 'This field is required'},
                 {'fields': {'username': 'peter', 'password': 'weak'},
                  'expect': 'at least 6 characters'},
                 {'fields': {'username': 'peter', 'password': 'wrongpassword'},
                  'expect': 'Invalid password'},
                 )
        for case in cases:
            response = self.www.post('/auth/sign-in', case['fields'])
            self.assertContains(response, 'class="error"')
            self.assertContains(response, case['expect'])

    def test_success(self):
        response = self.www
        response = self.www.post('/auth/sign-in',
                                 {'username': 'peter',
                                  'password': 'password'})
        self.assertEqual(response.status_code, 302)
        print response['Location']
        self.assertTrue(response['Location'].endswith('/auth/sign-in/'))


class ChallengeVerifyTest(TestCase):

    def setUp(self):
        self.peter = User(key_name='peter', username='Peter')
        self.peter.set_password('SecreT!1')
        self.peter.put()
        self.app = App(key_name='myapp', domains=['myapp.pageforest.com'],
                       secret=crypto.random64())
        self.app.put()
        self.app_client = Client(HTTP_HOST=self.app.domains[0])

    def sign_and_verify(self, challenge, username=None, password=None,
                        **kwargs):
        """Helper method to sign the challenge and attempt to sign in."""
        username = username or self.peter.username
        password = password or self.peter.password
        signed = crypto.sign(challenge, password)
        data = crypto.join(username.lower(), signed)
        return self.app_client.get('/auth/verify/' + data, **kwargs)

    def test_login(self):
        """Test challenge and verify."""
        # Get a challenge from the server.
        response = self.app_client.get('/auth/challenge')
        self.assertEqual(response.status_code, 200)
        challenge = response.content
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'myapp/peter/', status_code=200)
        cookie = response.cookies['reauth'].value
        self.assertTrue(cookie.startswith('myapp/peter/'))

    def test_invalid_challenge(self):
        """The challenge must have a valid HMAC."""
        # Get a challenge from the server.
        challenge = self.app_client.get('/auth/challenge').content
        # Alter the last letter of the challenge HMAC
        challenge = challenge[:-1] + 'x'
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'Challenge invalid.', status_code=403)

    def test_bogus_login(self):
        """Test that a bogus authentication string cannot login."""
        response = self.app_client.get('/auth/verify/x')
        self.assertContains(response, 'Expected 6 parts.', status_code=403)

    def test_expired_challenge(self):
        """Test that an expired challenge stops working."""

        def mock_time():
            """Mock up a 61 second delayed system time."""
            return real_time() - 61

        real_time = time.time
        time.time = mock_time
        try:
            challenge = self.app_client.get('/auth/challenge').content
        finally:
            time.time = real_time
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'Challenge expired.', status_code=403)

    def test_replay(self):
        """Test that a replay attack cannot login."""
        challenge = self.app_client.get('/auth/challenge').content
        # First login should be successful.
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'myapp/peter/', status_code=200)
        # Replay should fail with 403 Forbidden.
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'Already used.', status_code=403)

    def test_different_ip(self):
        """Test that different IP address cannot login."""
        challenge = self.app_client.get('/auth/challenge').content
        response = self.sign_and_verify(challenge, REMOTE_ADDR='1.1.1.1')
        self.assertContains(response, "IP address changed.", status_code=403)

    def test_unknown_user(self):
        """Test that unknown user cannot login."""
        challenge = self.app_client.get('/auth/challenge').content
        response = self.sign_and_verify(challenge, username='unknown')
        self.assertContains(response, "Unknown user.", status_code=403)

    def test_wrong_password(self):
        """Test that incorrect password cannot login."""
        challenge = self.app_client.get('/auth/challenge').content
        response = self.sign_and_verify(
            challenge, password=self.peter.password[::-1])
        self.assertContains(response, 'Password incorrect.',
                            status_code=403)


class SimpleAuthTest(TestCase):

    def setUp(self):
        self.peter = User(key_name='peter', username='Peter',
                          email='peter@example.com')
        self.peter.set_password('password')
        self.peter.put()
        self.paul = User(key_name='paul', username='Paul')
        self.paul.put()
        self.doc = Doc(key_name='myapp/mydoc', title='My Document',
                       readers=['peter'], writers=['peter'])
        self.doc.put()
        self.app = App(key_name='myapp', domains=['myapp.pageforest.com'],
                       secret=crypto.random64())
        self.app.put()
        self.app_client = Client(HTTP_HOST=self.app.domains[0])
        self.session_key = self.peter.generate_session_key(self.app)

    def test_bogus_session_key(self):
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = 'bogus'
        response = self.app_client.get('/docs/mydoc/')
        self.assertContains(response, "Expected 4 parts.", status_code=403)
        session_key = crypto.join(self.session_key, 'bogus')
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        response = self.app_client.get('/docs/mydoc/')
        self.assertContains(response, "Expected 4 parts.", status_code=403)

    def test_different_app(self):
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[0] = 'other'
        session_key = crypto.join(parts)
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        response = self.app_client.get('/docs/mydoc/')
        self.assertContains(response, "Different app.", status_code=403)

    def test_session_key_expired(self):
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[2] = int(time.time() - 10)
        session_key = crypto.join(parts)
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        response = self.app_client.get('/docs/mydoc/')
        self.assertContains(response, "Session key expired.", status_code=403)

    def test_unknown_user(self):
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[1] = 'unknown'
        session_key = crypto.join(parts)
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        response = self.app_client.get('/docs/mydoc/')
        self.assertContains(response, "Unknown user.", status_code=403)

    def test_incorrect_session_key(self):
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[-1] = parts[-1][::-1]  # Backwards.
        session_key = crypto.join(parts)
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        response = self.app_client.get('/docs/mydoc/')
        self.assertContains(response, "Password incorrect.", status_code=403)

    def test_different_user(self):
        session_key = self.paul.generate_session_key(self.app)
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = session_key
        response = self.app_client.get('/docs/mydoc/')
        self.assertContains(response, "Access denied.", status_code=403)
