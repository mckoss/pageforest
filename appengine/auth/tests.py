import time
import re
from datetime import datetime

from django.conf import settings
from django.test import TestCase
from django.test.client import Client

from auth.models import User
from apps.models import App
from docs.models import Doc

from utils import crypto

# Authentication application URL prefix
AUTH_PREFIX = "/"
SIGN_UP = AUTH_PREFIX + "sign-up/"
SIGN_IN = AUTH_PREFIX + "sign-in/"
SIGN_OUT = AUTH_PREFIX + "sign-out/"

APP_AUTH_PREFIX = "/auth/"


class UserTest(TestCase):

    def setUp(self):
        self.start_time = datetime.now()
        self.peter = User(key_name='peter', username='Peter')
        self.peter.put()
        self.paul = User(key_name='paul', username='Paul')
        self.paul.put()

    def test_random_salt(self):
        """The same password generates different hashes."""
        self.peter.set_password('secret')
        self.paul.set_password('secret')
        self.assertNotEqual(self.peter.password, self.paul.password)

    def test_timestamps(self):
        """The timestamps are properly set."""
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
        """Invalid usernames are rejected."""
        for char in '012_-.,!?$:@/':
            response = self.www.post(
                SIGN_UP, {'username': char + 'name'})
            self.assertContains(
                response, "Username must start with a letter.")

    def test_username_invalid_last(self):
        """Invalid usernames are rejected."""
        for char in '_-.,!?$:@/':
            response = self.www.post(
                SIGN_UP, {'username': 'name' + char})
            self.assertContains(
                response, "Username must end with a letter or number.")

    def test_username_invalid(self):
        """Invalid usernames are rejected."""
        for char in '_.,!?$:@/':
            response = self.www.post(
                SIGN_UP, {'username': 'a' + char + 'b'})
            self.assertContains(response,
                "Username must contain only letters, numbers and dashes.")

    def test_username_too_short(self):
        """Excessively short usernames are rejected."""
        response = self.www.post(SIGN_UP, {'username': 'a'})
        self.assertContains(response, "at least 2 characters")

    def test_username_too_long(self):
        """Excessively long usernames are rejected."""
        response = self.www.post(SIGN_UP, {'username': 'a' * 31})
        self.assertContains(response,
            "Ensure this value has at most 30 characters (it has 31).")

    def test_username_reserved(self):
        """Reserved usernames are enforced."""
        for name in 'root admin test'.split():
            response = self.www.post(SIGN_UP, {'username': name})
            self.assertContains(response, "This username is reserved.")

    def test_password_silly(self):
        """Silly passwords are rejected."""
        for password in '123456 aaaaaa qwerty qwertz mnbvcxz NBVCXY'.split():
            response = self.www.post(SIGN_UP, {'password': password})
            self.assertContains(response, "This password is too simple.")

    def test_username_taken(self):
        """Existing usernames are reserved."""
        response = self.www.post(SIGN_UP, {'username': 'peter'})
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
        """Errors on sign-in form."""
        cases = ({'fields': {'username': '', 'password': ''},
                  'expect': 'This field is required'},
                 {'fields': {'username': 'peter', 'password': 'weak'},
                  'expect': 'at least 6 characters'},
                 {'fields': {'username': 'peter', 'password': 'wrongpassword'},
                  'expect': 'Invalid password'},
                 )
        for case in cases:
            response = self.www.post(SIGN_IN, case['fields'])
            self.assertContains(response, 'class="error"')
            self.assertContains(response, case['expect'])

    def test_success(self):
        """Sign-in form success - cookie and redirect - sign-out."""
        response = self.www.post(SIGN_IN,
                                 {'username': 'peter',
                                  'password': 'password'})
        self.assertRedirects(response,
                             'http://www.pageforest.com' + SIGN_IN)
        cookie = response.cookies['sessionkey'].value
        self.assertTrue(cookie.startswith('www/peter/12'))

        # Simulate the redirect after POST
        response = self.www.post(SIGN_IN)
        self.assertContains(response, 'Peter, you are signed in to')

        # Now sign out the user - and check his cookies
        response = self.www.get(SIGN_OUT)
        self.assertRedirects(response,
                             'http://www.pageforest.com' + SIGN_IN)

        cookie = response.cookies['sessionkey']
        self.assertEqual(cookie.value, '')
        self.assertTrue(cookie['expires'] == 'Thu, 01-Jan-1970 00:00:00 GMT')

        # Simulate the redirect after GET
        response = self.www.post(SIGN_IN)
        self.assertContains(response, 'Sign in to Pageforest')


class AppSignInTest(TestCase):
    """
    Signing in to and out of an application should set session keys
    on both the pageforest.com domain AND the application domain.
    """
    def setUp(self):
        self.peter = User(key_name='peter',
                          username='Peter',
                          email='peter@example.com')
        self.peter.set_password('password')
        self.peter.put()
        self.app = App(key_name='myapp', domains=['myapp.pageforest.com'],
                       title="My Test App",
                         readers=['peter'], writers=['peter'])
        self.app.put()
        self.www = Client(HTTP_HOST='www.pageforest.com')
        self.myapp = Client(HTTP_HOST='myapp.pageforest.com')

    def test_errors(self):
        """Errors on application sign-in form."""
        cases = ({'fields': {'username': 'peter'},
                  'expect': 'This field is required'},
                 )
        for case in cases:
            response = self.www.post(SIGN_IN + 'myapp/', case['fields'])
            self.assertContains(response, 'class="error"')
            self.assertContains(response, case['expect'])

    def test_no_auth_on_app_domain(self):
        """Only have sign-in pages on the www.pf.com domain."""
        response = self.myapp.get('auth' + SIGN_IN)
        self.assertEqual(response.status_code, 404)

    def test_no_app(self):
        """Sign into non-existant application -> redirect."""
        response = self.www.get(SIGN_IN + 'noapp')
        self.assertRedirects(response,
                             'http://www.pageforest.com' + SIGN_IN)

    def test_sign_in(self):
        """Sign in to an application (from scratch)."""
        # Initial form - not signed in
        response = self.www.get(SIGN_IN + 'myapp/')
        self.assertContains(response, "Sign in to Pageforest")
        self.assertContains(response, "and My Test App.")

        response = self.www.post(SIGN_IN + 'myapp/',
                                 {'username': 'peter',
                                  'password': 'password',
                                  'app_auth': 'checked'})
        self.assertRedirects(response,
                             'http://www.pageforest.com' + SIGN_IN + 'myapp/')
        cookie = response.cookies['sessionkey'].value
        app_cookie = response.cookies['myapp-sessionkey'].value
        # Expect a first-part session cookie to www.pf.com
        self.assertTrue(cookie.startswith('www/peter/12'))
        # And a copy of the app session suitable to pass to myapp.pf.com
        self.assertTrue(app_cookie.startswith('myapp/peter/12'))

        # Simulate the redirect to the form
        response = self.www.post(SIGN_IN + 'myapp/')
        # We need the app-specific session cookie transfered to JavaScript
        self.assertContains(response, 'Peter, you are signed in to')
        match = myapp_session_key = re.search(r'transferSession\("(.*)"\)',
                                     response.content)
        self.assertTrue(match is not None)
        myapp_session_key = match.group(1)
        self.assertTrue(myapp_session_key.startswith("myapp/peter/12"))

        # Should not be logged in yet
        response = self.myapp.get(APP_AUTH_PREFIX + 'username/')
        self.assertEqual(response.status_code, 404)
        self.assertTrue('sessionkey' not in response.cookies)
        # Simulate the in-page javascript that does the cross-site
        # authentication
        response = self.myapp.get(APP_AUTH_PREFIX + 'set-session/' +
                                  myapp_session_key)
        cookie = response.cookies['sessionkey'].value
        self.assertTrue(cookie.startswith('myapp/peter/12'))
        # And confirm the username api returns the user
        response = self.myapp.get(APP_AUTH_PREFIX + 'username/')
        self.assertContains(response, "Peter")

        # And sign out to verify that the cross-app cookie is
        # marked 'expired'.
        response = self.myapp.get(APP_AUTH_PREFIX + 'set-session/expired/')
        cookie = response.cookies['sessionkey']
        self.assertEqual(cookie.value, '')
        self.assertTrue(cookie['expires'] == 'Thu, 01-Jan-1970 00:00:00 GMT')


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
        return self.app_client.get(APP_AUTH_PREFIX + 'verify/' + data,
                                   **kwargs)

    def test_login(self):
        """Test challenge and verify."""
        # Get a challenge from the server.
        response = self.app_client.get(APP_AUTH_PREFIX + 'challenge/')
        self.assertEqual(response.status_code, 200)
        challenge = response.content
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'myapp/peter/', status_code=200)
        cookie = response.cookies['reauth'].value
        self.assertTrue(cookie.startswith('myapp/peter/'))

    def test_invalid_challenge(self):
        """The challenge must have a valid HMAC."""
        # Get a challenge from the server.
        challenge = self.app_client.get(APP_AUTH_PREFIX + 'challenge/').content
        # Alter the last letter of the challenge HMAC
        challenge = challenge[:-1] + 'x'
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'Challenge invalid.', status_code=403)

    def test_bogus_login(self):
        """A bogus authentication string cannot login."""
        response = self.app_client.get(APP_AUTH_PREFIX + 'verify/x')
        self.assertContains(response, 'Expected 6 parts.', status_code=403)

    def test_expired_challenge(self):
        """An expired challenge stops working."""

        def mock_time():
            """Mock up a 61 second delayed system time."""
            return real_time() - 61

        real_time = time.time
        time.time = mock_time
        try:
            challenge = self.app_client.get(APP_AUTH_PREFIX + \
                                            'challenge/').content
        finally:
            time.time = real_time
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'Challenge expired.', status_code=403)

    def test_replay(self):
        """A replay attack cannot login."""
        challenge = self.app_client.get(APP_AUTH_PREFIX + 'challenge/').content
        # First login should be successful.
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'myapp/peter/', status_code=200)
        # Replay should fail with 403 Forbidden.
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'Already used.', status_code=403)

    def test_different_ip(self):
        """Different IP address cannot login."""
        challenge = self.app_client.get(APP_AUTH_PREFIX + 'challenge/').content
        response = self.sign_and_verify(challenge, REMOTE_ADDR='1.1.1.1')
        self.assertContains(response, "IP address changed.", status_code=403)

    def test_unknown_user(self):
        """Unknown user cannot login."""
        challenge = self.app_client.get(APP_AUTH_PREFIX + 'challenge/').content
        response = self.sign_and_verify(challenge, username='unknown')
        self.assertContains(response, "Unknown user.", status_code=403)

    def test_wrong_password(self):
        """Incorrect password cannot login."""
        challenge = self.app_client.get(APP_AUTH_PREFIX + 'challenge/').content
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
