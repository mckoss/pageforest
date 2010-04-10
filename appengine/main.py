import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'

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


def log_exception(*args, **kwds):
    logging.exception('Exception in request:')


def main():
    signals.got_request_exception.connect(log_exception)
    signals.got_request_exception.disconnect(db._rollback_on_exception)
    application = wsgi.WSGIHandler()
    run_wsgi_app(application)


if __name__ == '__main__':
    main()
