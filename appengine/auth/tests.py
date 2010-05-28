import time
import re

from django.conf import settings
from django.test import Client

from google.appengine.api import mail

from auth.models import User

from apps.tests import AppTestCase
from utils import crypto

# Default pageforest domain url
WWW = "http://www.pageforest.com"

# Authentication application URL prefix
AUTH_PREFIX = "/"
SIGN_UP = AUTH_PREFIX + "sign-up/"
SIGN_IN = AUTH_PREFIX + "sign-in/"
SIGN_OUT = AUTH_PREFIX + "sign-out/"
EMAIL_VERIFY = AUTH_PREFIX + "email-verify/"

APP_AUTH_PREFIX = "/auth/"


class UserTest(AppTestCase):

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


class RegistrationTest(AppTestCase):

    def test_username_invalid_first(self):
        """Invalid usernames are rejected."""
        for char in '012_-.,!?$:@/':
            response = self.www_client.post(
                SIGN_UP, {'username': char + 'name'})
            self.assertContains(
                response, "Username must start with a letter.")

    def test_username_invalid_last(self):
        """Invalid usernames are rejected."""
        for char in '_-.,!?$:@/':
            response = self.www_client.post(
                SIGN_UP, {'username': 'name' + char})
            self.assertContains(
                response, "Username must end with a letter or number.")

    def test_username_invalid(self):
        """Invalid usernames are rejected."""
        for char in '_.,!?$:@/':
            response = self.www_client.post(
                SIGN_UP, {'username': 'a' + char + 'b'})
            self.assertContains(response,
                "Username must contain only letters, numbers and dashes.")

    def test_username_too_short(self):
        """Excessively short usernames are rejected."""
        response = self.www_client.post(SIGN_UP, {'username': 'a'})
        self.assertContains(response, "at least 2 characters")

    def test_username_too_long(self):
        """Excessively long usernames are rejected."""
        response = self.www_client.post(SIGN_UP, {'username': 'a' * 31})
        self.assertContains(response,
            "Ensure this value has at most 30 characters (it has 31).")

    def test_username_reserved(self):
        """Reserved usernames are enforced."""
        for name in 'root admin test'.split():
            response = self.www_client.post(SIGN_UP, {'username': name})
            self.assertContains(response, "This username is reserved.")

    def test_password_silly(self):
        """Silly passwords are rejected."""
        for password in '123456 aaaaaa qwerty qwertz mnbvcxz NBVCXY'.split():
            response = self.www_client.post(SIGN_UP, {'password': password})
            self.assertContains(response, "This password is too simple.")

    def test_username_taken(self):
        """Existing usernames are reserved."""
        response = self.www_client.post(SIGN_UP, {'username': 'peter'})
        self.assertContains(response, "This username is already taken.")

    def test_new_registration(self):
        """Complete a user registration successfully."""
        mail_kwargs = {}

        def mock_send_mail(*args, **kwargs):
            """Assume we always use keyword args."""
            self.assertEqual(len(args), 0)
            mail_kwargs.update(kwargs)
            real_send_mail(*args, **kwargs)

        (real_send_mail, mail.send_mail) = (mail.send_mail, mock_send_mail)
        try:
            response = self.www_client.post(SIGN_UP, {
                    'username': 'Mary',
                    'password': 'afinepassword',
                    'repeat': 'afinepassword',
                    'email': 'mary@bunyan.com',
                    'tos': 'checked',
                    })
            self.assertRedirects(response, WWW + SIGN_IN)
            mary = User.lookup('mary')
            self.assertTrue(mary is not None)
            self.assertEqual(mary.username, 'Mary')
            self.assertEqual(mary.get_username(), 'mary')
            self.assertEqual(mail_kwargs['sender'], 'support@pageforest.com')
            self.assertEqual(mail_kwargs['to'], 'mary@bunyan.com')
            self.assertTrue(mail_kwargs['subject'].find("Pageforest") != -1)
            verify_url = re.search
            match = re.search('(' + WWW + EMAIL_VERIFY + '.*/)',
                               mail_kwargs['body'])
            self.assertTrue(match is not None)
            verify_url = match.group(1)

            response = self.www_client.get(verify_url)
            self.assertContains(response,
                                "Your email address has  been verified.")

        finally:
            mail.send_mail = real_send_mail


class SignInTest(AppTestCase):

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
            response = self.www_client.post(SIGN_IN, case['fields'])
            self.assertContains(response, 'class="error"')
            self.assertContains(response, case['expect'])

    def test_success(self):
        """Sign-in form success - cookie and redirect - sign-out."""
        response = self.www_client.post(SIGN_IN, {
                'username': 'peter',
                'password': 'peter_secret'})
        self.assertRedirects(response, WWW + SIGN_IN)
        cookie = response.cookies['sessionkey']
        self.assertTrue(cookie.value.startswith('www|peter|12'))
        self.assertEqual(cookie['max-age'], 86400)
        self.assertTrue(cookie['httponly'])

        # Simulate the redirect after POST
        response = self.www_client.post(SIGN_IN)
        self.assertContains(response, 'Peter, you are signed in to')

        # Now sign out the user - and check his cookies
        response = self.www_client.get(SIGN_OUT)
        self.assertRedirects(response, WWW + SIGN_IN)

        cookie = response.cookies['sessionkey']
        self.assertEqual(cookie.value, '')
        self.assertTrue(cookie['expires'] == 'Thu, 01-Jan-1970 00:00:00 GMT')
        self.assertTrue(cookie['httponly'])

        # Simulate the redirect after GET
        response = self.www_client.post(SIGN_IN)
        self.assertContains(response, 'Sign in to Pageforest')


class AppSignInTest(AppTestCase):
    """
    Signing in to and out of an application should set session keys
    on both the pageforest.com domain AND the application domain.
    """

    def test_errors(self):
        """Errors on application sign-in form."""
        cases = ({'fields': {'username': 'peter'},
                  'expect': 'This field is required'},
                 )
        for case in cases:
            response = self.www_client.post(SIGN_IN + 'myapp/', case['fields'])
            self.assertContains(response, 'class="error"')
            self.assertContains(response, case['expect'])

    def test_no_auth_on_app_domain(self):
        """Only have sign-in pages on the www.pageforest.com domain."""
        response = self.app_client.get('auth' + SIGN_IN)
        self.assertEqual(response.status_code, 404)

    def test_no_app(self):
        """Sign into non-existant application -> redirect."""
        response = self.www_client.get(SIGN_IN + 'noapp')
        self.assertRedirects(response, WWW + SIGN_IN)

    def test_sign_in(self):
        """Sign in to an application (from scratch)."""
        # Initial form - not signed in
        response = self.www_client.get(SIGN_IN + 'myapp/')
        self.assertContains(response, "Sign in to Pageforest")
        self.assertContains(response, "and My Test App")

        response = self.www_client.post(SIGN_IN + 'myapp/',
                                 {'username': 'peter',
                                  'password': 'peter_secret',
                                  'app_auth': 'checked'})
        self.assertRedirects(response, WWW + SIGN_IN + 'myapp/')
        # Expect a first-party session cookie to www.pageforest.com
        cookie = response.cookies['sessionkey']
        self.assertTrue(cookie.value.startswith('www|peter|12'))
        self.assertTrue(cookie['httponly'])
        # And a copy of the app session to pass to myapp.pageforest.com
        app_cookie = response.cookies['myapp-sessionkey']
        self.assertTrue(app_cookie.value.startswith('myapp|peter|12'))
        self.assertTrue(app_cookie['httponly'])

        # Simulate the redirect to the form
        response = self.www_client.post(SIGN_IN + 'myapp/')
        # We need the app-specific session cookie transfered to JavaScript
        self.assertContains(response, 'Peter, you are signed in to')
        match = re.search(r'transferSession\("(.*)"\)', response.content)
        self.assertTrue(match is not None)
        myapp_session_key = match.group(1)
        self.assertTrue(myapp_session_key.startswith("myapp|peter|12"))

        # Should not be logged in yet
        response = self.app_client.get(APP_AUTH_PREFIX + 'username/')
        self.assertEqual(response.status_code, 404)
        self.assertTrue('sessionkey' not in response.cookies)

        # Simulate the in-page javascript that does the cross-site
        # authentication
        self.app_client.defaults['HTTP_REFERER'] = \
            "http://www.pageforest.com/sign-in/"
        response = self.app_client.get(
            APP_AUTH_PREFIX + 'set-session/' +
            myapp_session_key + '?callback=jsonp123')
        del self.app_client.defaults['HTTP_REFERER']
        self.assertEqual(response.content,
                         'jsonp123("' + myapp_session_key + '")')
        cookie = response.cookies['sessionkey']
        self.assertTrue(cookie.value.startswith('myapp|peter|12'))
        # And confirm the username api returns the user
        response = self.app_client.get(APP_AUTH_PREFIX + 'username/')
        self.assertContains(response, "Peter")

        # And sign out to verify that the cross-app cookie is
        # marked 'expired'.
        response = self.app_client.get(
            APP_AUTH_PREFIX + 'set-session/expired/')
        cookie = response.cookies['sessionkey']
        self.assertEqual(cookie.value, '')
        self.assertTrue(cookie['expires'] == 'Thu, 01-Jan-1970 00:00:00 GMT')


class ChallengeVerifyTest(AppTestCase):

    def sign_and_verify(self, challenge, username=None, password=None,
                        **kwargs):
        """Helper method to sign the challenge and attempt to sign in."""
        username = username or self.peter.username
        password = password or self.peter.password
        signed = crypto.sign(challenge, password)
        data = crypto.join(username.lower(), signed)
        return self.app_client.get(
            APP_AUTH_PREFIX + 'verify/' + data, **kwargs)

    def test_login(self):
        """Test challenge and verify."""
        # Get a challenge from the server.
        response = self.app_client.get(APP_AUTH_PREFIX + 'challenge/')
        self.assertEqual(response.status_code, 200)
        challenge = response.content
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'myapp|peter|12', status_code=200)
        cookie = response.cookies['reauth'].value
        self.assertTrue(cookie.startswith('myapp|peter|12'))

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
            challenge = self.app_client.get(
                APP_AUTH_PREFIX + 'challenge/').content
        finally:
            time.time = real_time
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'Challenge expired.', status_code=403)

    def test_replay(self):
        """A replay attack cannot login."""
        challenge = self.app_client.get(APP_AUTH_PREFIX + 'challenge/').content
        # First login should be successful.
        response = self.sign_and_verify(challenge)
        self.assertContains(response, 'myapp|peter|12', status_code=200)
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


class SimpleAuthTest(AppTestCase):

    def setUp(self):
        super(SimpleAuthTest, self).setUp()
        self.app.readers = []
        self.app.put()
        self.session_key = self.peter.generate_session_key(self.app)

    def test_bogus_session_key(self):
        """Bogus session key should return error message."""
        # Not enough parts.
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = 'bogus'
        response = self.app_client.get('/')
        self.assertContains(response, "Expected 4 parts.", status_code=403)
        # Too many parts.
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            crypto.join(self.session_key, 'bogus')
        response = self.app_client.get('/')
        self.assertContains(response, "Expected 4 parts.", status_code=403)

    def test_session_key_expired(self):
        """Expired session key should return error message."""
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[2] = int(time.time() - 10)
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            crypto.join(parts)
        response = self.app_client.get('/')
        self.assertContains(response, "Session key expired.", status_code=403)

    def test_different_app(self):
        """Session key for a different app should return error message."""
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[0] = 'other'
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            crypto.join(parts)
        response = self.app_client.get('/')
        self.assertContains(response, "Different app.", status_code=403)

    def test_different_user(self):
        """Session key for different user should return error message."""
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.paul.generate_session_key(self.app)
        response = self.app_client.get('/')
        self.assertContains(response, "Read permission denied.",
                            status_code=403)

    def test_unknown_user(self):
        """Session key with unknown user should return error message."""
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[1] = 'unknown'
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            crypto.join(parts)
        response = self.app_client.get('/')
        self.assertContains(response, "Unknown user.", status_code=403)

    def test_incorrect_session_key(self):
        """Incorrect password should return error message."""
        parts = self.session_key.split(crypto.SEPARATOR)
        parts[-1] = parts[-1][::-1]  # Backwards.
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            crypto.join(parts)
        response = self.app_client.get('/')
        self.assertContains(response, "Password incorrect.", status_code=403)


class AnonymousTest(AppTestCase):
    """
    Anonymous user (without session key) should have limited access.
    """

    def test_www(self):
        """Anonymous user should have access to www front-end."""
        self.assertContains(self.www_client.head('/'), '')
        self.assertContains(self.www_client.get('/'), 'Pageforest')

    def test_apps(self):
        """Anonymous user should have read-only access to /apps/."""
        self.assertContains(self.www_client.get('/apps/'), 'apps')
        self.assertContains(self.www_client.put('/apps/'), '',
                            status_code=405)

    def test_docs(self):
        """Anonymous user should not have access to /docs/."""
        self.assertContains(self.www_client.get('/docs/'),
                            'Access denied.', status_code=403)

    def test_sign_in(self):
        """Anonymous user should have access to sign-in pages."""
        self.assertContains(self.www_client.get('/sign-in'), 'Password')
        self.assertContains(self.www_client.post('/sign-in', {'foo': 'bar'}),
                            'This field is required.')

    def test_app_json(self):
        """Anonymous user should have read-only access to public app.json."""
        self.assertContains(self.admin_client.get('/app.json'),
                            '"readers": [')
        self.assertContains(self.admin_client.put('/app.json'),
                            'Write permission denied.', status_code=403)

    def test_app(self):
        """Anonymous user should have read-only access to public apps."""
        self.assertContains(self.app_client.get('/'), '<html>')
        self.assertContains(self.app_client.get('/index.html'), '<html>')
        self.assertEquals(self.app_client.put('/').status_code, 405)
        self.assertEquals(self.app_client.put('/index.html').status_code, 405)
        self.assertEquals(self.app_client.put('/new.html').status_code, 405)

    def test_doc(self):
        """Anonymous user should have read-only access to public docs."""
        self.assertContains(self.app_client.get('/docs/mydoc'), '"readers"')
        self.assertContains(self.app_client.put('/docs/mydoc'),
                            'Write permission denied.', status_code=403)
        self.assertContains(self.app_client.put('/docs/newdoc'),
                            'Write permission denied.', status_code=403)
        self.assertContains(self.app_client.get('/docs/mydoc/myblob'), 'json')
        self.assertContains(self.app_client.put('/docs/mydoc/myblob'),
                            'Write permission denied.', status_code=403)
        self.assertContains(self.app_client.put('/docs/mydoc/newblob'),
                            'Write permission denied.', status_code=403)


class AppCreatorTest(AppTestCase):
    """
    Test permissions for app creators.
    """

    def sign_in(self, app_id, user):
        self.client = Client(
            HTTP_HOST='%s.%s.pageforest.com' % (
                settings.ADMIN_SUBDOMAIN, app_id),
            HTTP_REFERER='http://www.pageforest.com/')
        # Get auth challenge from dev.app_id.pageforest.com.
        response = self.client.get('/auth/challenge')
        self.assertEqual(response.status_code, 200)
        challenge = response.content
        # Sign challenge and authenticate.
        signature = crypto.hmac_sha1(challenge, user.password)
        reply = crypto.join(user.get_username(), challenge, signature)
        response = self.client.get('/auth/verify/' + reply)
        self.assertEqual(response.status_code, 200)
        self.client.cookies[settings.SESSION_COOKIE_NAME] = response.content

    def test_email_not_verified(self):
        self.sign_in('paulsapp', self.paul)
        response = self.client.put('/app.json', '{}',
                                   content_type='application/json')
        self.assertContains(response, 'Please verify your email address.',
                            status_code=403)

    def test_eleven_apps(self):
        for index in range(2, 12):
            self.sign_in('myapp%d' % index, self.peter)
            response = self.client.put('/app.json', '{}',
                                       content_type='application/json')
            if index < 11:
                self.assertContains(response, 'Saved')
        self.assertContains(
            response, 'You have already created 10 apps.',
            status_code=403)


class CookieTest(AppTestCase):
    resources = {
        '/': (200, '<html>'),
        '/index.html': (200, '<html>'),
        '/does/not/exist.txt': (404, 'Blob not found'),
        '/docs/mydoc/': (200, '"title":'),
        '/docs/mydoc/myblob/': (200, '["json"]'),
        '/docs/mydoc/?method=list': (200, '"myblob":'),
        }

    def test_public_read(self):
        """The anonymous user should have read access."""
        for url in self.resources:
            response = self.app_client.get(url)
            (status_code, content) = self.resources[url]
            self.assertContains(
                response, content, status_code=status_code)

    def test_owner_read(self):
        """The sessionkey cookie should work for all resources."""
        self.app.readers = []
        self.app.put()
        self.doc.readers = []
        self.doc.put()
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.app)
        for url in self.resources:
            response = self.app_client.get(url)
            (status_code, content) = self.resources[url]
            self.assertContains(
                response, content, status_code=status_code)

    def test_docs_referer(self):
        """The referer check should deny /docs/."""
        self.app.readers = []
        self.app.put()
        self.doc.readers = []
        self.doc.put()
        self.app_client.cookies[settings.SESSION_COOKIE_NAME] = \
            self.peter.generate_session_key(self.app)
        for url in self.resources:
            response = self.app_client.get(
                url, HTTP_REFERER='http://myapp.pageforest.com/docs/')
            self.assertContains(
                response, 'Untrusted Referer path: /docs/', status_code=403)
