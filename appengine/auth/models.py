from google.appengine.ext import db
from google.appengine.api import mail

from django.template.loader import render_to_string
from django.template import RequestContext

from utils.mixins import Migratable, Cacheable
from utils import crypto

import settings


class User(db.Expando, Migratable, Cacheable):
    """
    The entity key name is username.lower() for case-insensitive matching.
    The password is hmac_sha1(key=raw_password, message=username.lower()).
    """
    username = db.StringProperty()  # May include capital letters.
    email = db.EmailProperty()
    password = db.StringProperty()
    # TODO: Not updated for each login?
    last_login = db.DateTimeProperty(auto_now_add=True)
    date_joined = db.DateTimeProperty(auto_now_add=True)
    date_verified = db.DateTimeProperty()

    def __unicode__(self):
        return self.username

    def set_password(self, password):
        """
        Generate HMAC of the username, using the password as secret key.
        This is similar to hashing the password with salt=username.
        """
        self.password = crypto.hmac_sha1(self.username.lower(), password)

    def check_password(self, password):
        """
        Returns a boolean of whether the (plaintext) password was correct.
        Handles encryption formats behind the scenes.
        """
        return crypto.hmac_sha1(self.username.lower(),
                                password) == self.password

    def migrate(self, next_schema):
        """
        Migrate from one model schema to the next.
        """
        pass

    def send_email_verification(self, request):
        return
        message = render_to_string('auth/verify-email.txt',
                                   RequestContext(request, locals()))
        mail.send_mail(sender=settings.SITE_EMAIL_FROM,
                       to=self.email,
                       subject=settings.SITE_NAME + " account verification.",
                       body=message)
