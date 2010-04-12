from datetime import datetime

from django.test import TestCase

from auth.models import User


class UserTest(TestCase):

    def setUp(self):
        self.start_time = datetime.now()
        self.peter = User(key_name='peter')
        self.peter.put()
        self.paul = User(key_name='paul')
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
            self.migrated = True

        # TODO: The following monkey patch might break other tests.
        User.migrate = dummy_migrate
        User.schema_current = 2
        self.peter.migrated = False
        self.assertEqual(self.peter.schema, 1)
        self.peter.update_schema()
        self.assertTrue(self.peter.migrated)
        self.assertEqual(self.peter.schema, 2)


class RegistrationTest(TestCase):

    def test_reserved_usernames(self):
        """Test that reserved usernames are enforced."""
        for name in 'root admin test'.split():
            response = self.client.post('/auth/register/', {'username': name})
            self.assertContains(response, 'reserved')
