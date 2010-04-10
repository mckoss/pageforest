"""
Django settings for appengine project.
"""

import os
import sys

from settingsauto import *

# App Engine specific environment variables.
APPLICATION_ID = os.environ.get('APPLICATION_ID', '')
CURRENT_VERSION_ID = os.environ.get('CURRENT_VERSION_ID', '')
SERVER_SOFTWARE = os.environ.get('SERVER_SOFTWARE', '')
AUTH_DOMAIN = os.environ.get('AUTH_DOMAIN', '')

DEV_APPSERVER = SERVER_SOFTWARE.startswith("Development")
DEBUG = DEV_APPSERVER
TEMPLATE_DEBUG = DEBUG

ADMINS = (
    ('Mike Koss', 'mckoss@startpad.org'),
    ('Johann C. Rocholl', 'johann@rocholl.net'),
)

MANAGERS = ADMINS

# Memcache key prefix for Cacheable mixin class.
# Change this before deploying incompatible changes.
CACHEABLE_PREFIX = 'C1'

# Use appengine database backend for "manage.py test" etc.
if os.path.basename(sys.argv[0]) == 'manage.py':
    DATABASE_ENGINE = 'appengine'

# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
# although not all choices may be available on all operating systems.
# If running in a Windows environment this must be set to the same as your
# system time zone.
TIME_ZONE = 'UTC'
# Must be set to UTC, because that's used internally by the datastore.

# Language code for this installation. All choices can be found here:
# http://www.i18nguy.com/unicode/language-identifiers.html
LANGUAGE_CODE = 'en-us'

SITE_ID = 1

# If you set this to False, Django will make some optimizations so as not
# to load the internationalization machinery.
USE_I18N = False

# We don't let CommonMiddleware create ETag headers because we
# decorate our view functions with @last_modified instead.
USE_ETAGS = False

# Canonical second-level domain name.
DEFAULT_DOMAIN = 'pageforest.com'
DOMAINS = 'pageforest.com pgfrst.com'.split()

# Absolute path to the directory that holds media.
# Example: "/home/media/media.lawrence.com/"
MEDIA_ROOT = ''
MEDIA_VERSION = 1

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash if there is a path component (optional in other cases).
# Examples: "http://media.lawrence.com", "http://example.com/media/"
# See settingsauto.py for MEDIA_VERSION
MEDIA_URL = '/static/'

# Make this unique, and don't share it with anybody.
SECRET_KEY = 'sy(#_hoi=$4&g%@a(azd+p%d1835z1pw@mxel+1ab%&^jlnq#@'

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.load_template_source',
    'django.template.loaders.app_directories.load_template_source',
)

TEMPLATE_CONTEXT_PROCESSORS = (
    # 'django.contrib.auth.context_processors.auth',
    # 'django.core.context_processors.debug',
    # 'django.core.context_processors.media',
    'django.core.context_processors.request',
    # 'django.contrib.messages.context_processors.messages',
    'utils.context_processors.settings',
    'utils.context_processors.combined_files',
)

MIDDLEWARE_CLASSES = (
    'google.appengine.ext.appstats.recording.AppStatsDjangoMiddleware',
    'django.middleware.common.CommonMiddleware',
    # 'django.contrib.sessions.middleware.SessionMiddleware',
    # 'django.contrib.auth.middleware.AuthenticationMiddleware',
)

ROOT_URLCONF = 'urls'

# Find templates in the same folder as settings.py.
SETTINGS_PATH = os.path.normpath(os.path.dirname(__file__))
TEMPLATE_DIRS = (
    os.path.join(SETTINGS_PATH, 'templates'),
)

INSTALLED_APPS = (
    # 'django.contrib.auth',
    'django.contrib.humanize',
    # 'django.contrib.contenttypes',
    # 'django.contrib.sessions',
    # 'django.contrib.sites',
    'auth',
    'apps',
    'data',
    'documents',
    'demo',
    'dashboard',
    'utils',
)

# Combined JavaScript and CSS files
COMBINE_FILES = not DEBUG
#COMBINE_FILES = True
FILE_GROUPS = {
    'js': {
        'pageforest': ['namespace', 'json2', 'formatutil', 'dateutil', 'data'],
        'widget': ['namespace', 'data', 'widget-ui'],
        },

    'css': {
        'default': ['main', 'home'],
        },
    }
