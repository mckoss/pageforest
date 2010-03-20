import os
import logging

# Google App Engine imports.
from google.appengine.ext.webapp import util

# Must set this env var before importing any part of Django
# 'project' is the name of the project created with django-admin.py
os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'

# Force Django to reload its settings.
from django.conf import settings
settings._target = None

import logging
import django.core.handlers.wsgi
import django.core.signals
import django.db
import django.dispatch.dispatcher


def log_exception(*args, **kwds):
    logging.exception('Exception in request:')


def main():
    # Create a Django application for WSGI.
    application = django.core.handlers.wsgi.WSGIHandler()
    # Run the WSGI CGI handler with that application.
    util.run_wsgi_app(application)


if __name__ == '__main__':
    # Log errors.
    django.dispatch.dispatcher.connect(
        log_exception, django.core.signals.got_request_exception)
    # Unregister the rollback event handler.
    django.dispatch.dispatcher.disconnect(
        django.db._rollback_on_exception,
        django.core.signals.got_request_exception)
    # Run Django's WSGI handler.
    main()
