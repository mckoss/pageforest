import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'

import sys
if 'django' in sys.modules and 'test' not in sys.argv:
    if sys.modules['django'].VERSION[0] == 0:
        # Remove Django 0.96 if it was loaded by appstats or shell.
        del sys.modules['django']

from google.appengine.dist import use_library
use_library('django', '1.1')

import logging

from google.appengine.ext.webapp.util import run_wsgi_app

from django import db
from django.core import signals
from  django.core.handlers import wsgi

# Force Django to reload its settings.
from django.conf import settings
settings._target = None


def log_exception(*args, **kwargs):
    """Save exceptions to the server log."""
    logging.exception('Exception in request:')


def main():
    """Run Django as a WSGI application."""
    signals.got_request_exception.connect(log_exception)
    signals.got_request_exception.disconnect(db._rollback_on_exception)
    application = wsgi.WSGIHandler()
    run_wsgi_app(application)


if __name__ == '__main__':
    main()
