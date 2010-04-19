from datetime import datetime

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
        self.app = App(key_name='myapp', domain='myapp.pageforest.com',
                       secret=crypto.random64())
        self.app.put()
        self.auth = Client(HTTP_HOST='auth.' + self.app.domain)

    def test_login(self):
        """Test challenge and login."""
        # Get a challenge from the server.
        response = self.auth.get('/challenge/')
        self.assertContains(response, '$201')
        self.assertEqual(len(response.content), 94)
        # Sign the challenge and attempt login.
        print self.peter.password
        signed = crypto.sign(response.content, self.peter.password)
        print signed
        data = crypto.join(self.peter.username.lower(), signed)
        response = self.auth.post('/login/', data, content_type='text/plain')
        self.assertContains(response, 'myapp$peter$201')
        print response.content
