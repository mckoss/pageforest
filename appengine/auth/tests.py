from datetime import datetime

from django.test import TestCase

from auth.models import User


class UserTest(TestCase):

    def setUp(self):
        self.start_time = datetime.now()
        self.max = User(key_name='max')
        self.max.put()
        self.moe = User(key_name='moe')
        self.moe.put()

    def test_random_salt(self):
        """Test that the same password generates different hashes."""
        self.max.set_password('secret')
        self.moe.set_password('secret')
        self.assertNotEqual(self.max.password, self.moe.password)

    def test_timestamps(self):
        """Test that the timestamps are properly set."""
        self.assertTrue(self.max.date_joined > self.start_time)
        self.assertTrue(self.max.last_login > self.start_time)
        self.assertTrue(self.moe.date_joined > self.max.date_joined)
