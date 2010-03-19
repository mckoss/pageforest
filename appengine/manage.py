#!/usr/bin/env python

"""
App Engine Helper is required to run this manage.py:
http://code.google.com/p/google-app-engine-django/

Install the appengine_django folder somewhere in sys.path, but not in
this application directory, because we don't want to deploy it to App
Engine for the production system.

The following files should be removed because they're broken:
appengine_django/tests/integration_test.py
appengine_django/tests/serialization_test.py
"""

import os
import appengine_django

# Adjust path because appengine_django is not installed
# in the application directory.
appengine_django.PARENT_DIR = os.path.dirname(__file__)
appengine_django.InstallAppengineHelperForDjango()

from django.core.management import execute_manager
try:
    import settings  # Assumed to be in the same directory.
except ImportError:
    import sys
    sys.stderr.write("""\
Error: Can't find the file 'settings.py' in the directory containing
%r. It appears you've customized things. You'll have to run
django-admin.py, passing it your settings module. (If the file
settings.py does indeed exist, it's causing an ImportError somehow.)
""" % __file__)
    sys.exit(1)

if __name__ == "__main__":
    execute_manager(settings)
