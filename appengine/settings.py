"""
Django settings for appengine project.
"""

import os
import sys

# These variables available in all template files using RequestContext
SAFE_SETTINGS = [
    'APPLICATION_ID', 'CURRENT_VERSION_ID',
    'SERVER_SOFTWARE', 'AUTH_DOMAIN', 'ANALYTICS_CODE',
    'SITE_NAME', 'SITE_OWNER', 'SITE_CONTACT_INFO', 'SITE_EMAIL_FROM',
    'DEV_APPSERVER', 'DEBUG', 'TEMPLATE_DEBUG',
    'ADMINS', 'MANAGERS',
    'DEFAULT_DOMAIN', 'DOMAINS',
    'MEDIA_URL', 'MEDIA_VERSION', 'LIB_URL', 'LIB_VERSION',
    'COMBINE_FILES',
]

# App Engine specific environment variables.
APPLICATION_ID = os.environ.get('APPLICATION_ID', '')
CURRENT_VERSION_ID = os.environ.get('CURRENT_VERSION_ID', '')
SERVER_SOFTWARE = os.environ.get('SERVER_SOFTWARE', '')
AUTH_DOMAIN = os.environ.get('AUTH_DOMAIN', '')

DEV_APPSERVER = SERVER_SOFTWARE.startswith("Development")
RUNNING_ON_GAE = SERVER_SOFTWARE.startswith("Google App Engine")

DEBUG = DEV_APPSERVER
#DEBUG = False
TEMPLATE_DEBUG = DEBUG

USE_APPSTATS = not DEBUG

ADMINS = (
    ('Mike Koss', 'mckoss@pageforest.com'),
    ('Johann C. Rocholl', 'jcrocholl@pageforest.com'),
)

MANAGERS = ADMINS

SITE_NAME = "Pageforest"
SITE_OWNER = "StartPad"
SITE_CONTACT_INFO = "811 First Ave, Suite 480, Seattle, WA 98104"
SITE_EMAIL_FROM = "support@pageforest.com"

# Memcache key prefix for Cacheable mixin class.
# Change this before deploying incompatible changes.
CACHEABLE_PREFIX = 'C2'

# Cacheable mixin: show memcache and datastore hits in the server log.
CACHEABLE_LOGGING = False

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

# We don't let CommonMiddleware redirect to add www or slashes.
PREPEND_WWW = False
APPEND_SLASH = False

# Content-Type header for JSON data.
JSON_MIMETYPE = 'application/json'

# Allowed formats for pageforest identifiers:
USERNAME_REGEX = r"[a-zA-Z][a-zA-Z0-9-]{,30}[a-zA-Z0-9]"
APP_ID_REGEX = r"[a-z][a-z0-9-]{,30}[a-z0-9]"
DOC_ID_REGEX = r"[a-zA-Z0-9_-][a-zA-Z0-9\._-]{,99}"

# Canonical second-level domain name.
DEFAULT_DOMAIN = 'pageforest.com'

# Trusted domains (for app_id.domain.tld lookup).
DOMAINS = [
    'pageforest.com',
    'pageforest.appspot.com',
    'version.latest.pageforest.appspot.com',
    'pgfrst.com',
    'pgfr.st',
    'pageforest',
    'localhost',
]

ANALYTICS_CODE = "UA-2072869-2"

# Absolute path to the directory that holds media.
# Example: "/home/media/media.lawrence.com/"
MEDIA_ROOT = ''

# URL that handles the media served from MEDIA_ROOT. Make sure to use a
# trailing slash if there is a path component (optional in other cases).
# Examples: "http://media.lawrence.com", "http://example.com/media/"
MEDIA_URL = '/static/'
MEDIA_VERSION = '2'

LIB_URL = '/lib/'
LIB_VERSION = '0.5.3'

# Make this unique, and don't share it with anybody.
SECRET_KEY = 'sy(#_hoi=$4&g%@a(azd+p%d1835z1pw@mxel+1ab%&^jlnq#@'

# Don't include these properties in user-facing JSON output.
HIDDEN_PROPERTIES = (
    'secret',
    'created_ip',
    'modified_ip',
    'schema',
    )

# Prevent account registration with some well-known usernames.
# This must be all lowercase, because it is matched against username.lower().
RESERVED_USERNAMES = """
public authenticated

admin administrator root
staff info spam abuse
www www-data webmaster postmaster
test tester testuser testclient
friends family
anonymous unknown noname
everybody anybody nobody private owner
""".split()

# Prevent app registration with some special app names.
# Note that 'www' is the default PF app - always available.
RESERVED_APPS = """
meta ssl static auth oauth login dev
doc docs document documents
blog list note comment
test tester testclient testserver latest
pageforest pgfrst page
app apps application applications app_id appid
css img images js javascript lib
google microsoft twitter yahoo facebook fb
flickr
profile
""".split()

# Reserved key prefixes in the application namespace.
# http://app_id.pageforest.com/_key_/...
# Internally, these are mapped to:
# /app/_key_/...
# TODO: Check for these prefixes in the application blob
# uploader on the server side.
RESERVED_APP_KEYS = (
    'docs',          # Saved application documents
    'auth',          # Authentication urls
    'static',        # Used in app.yaml
    'lib',           # Used in app.yaml
    'shell',         # Used in app.yaml
    'stats',         # Used in app.yaml

    # Reserved for future use
    'data',
    'admin',         # Future admin pages
    )

# Name of the session cookie for simple request authentication.
# TODO: For now - 30 days - with reauth, set to 24 hours.
SESSION_COOKIE_NAME = 'sessionkey'
SESSION_COOKIE_AGE = 30 * 24 * 60 * 60

# Name of the reauth cookie on app_id.pageforest.com
# TODO: We currently don't support reauthorization.
REAUTH_COOKIE_NAME = 'reauth'
REAUTH_COOKIE_PATH = '/auth/reauth'
REAUTH_COOKIE_AGE = 30 * 24 * 60 * 60  # 30 days.

# List of callables that know how to import templates from various sources.
TEMPLATE_LOADERS = (
    'django.template.loaders.filesystem.load_template_source',
    'django.template.loaders.app_directories.load_template_source',
)

TEMPLATE_CONTEXT_PROCESSORS = (
    # 'django.core.context_processors.debug',
    # 'django.core.context_processors.media',
    'django.core.context_processors.request',
    # 'django.contrib.messages.context_processors.messages',
    'utils.context_processors.safe_settings',
    'utils.context_processors.combined_files',
    'apps.middleware.app_context',
    'auth.middleware.user_context',
)

MIDDLEWARE_CLASSES = [
    'utils.middleware.ResponseNotFoundMiddleware',  # Render HTML for 404.
    'utils.middleware.RequestMiddleware',    # Put request in threading.local()
    'utils.middleware.WwwMiddleware',        # Prepend www if it's missing.
    'utils.middleware.SlashMiddleware',      # Add trailing slash if needed.
    'apps.middleware.AppMiddleware',         # Get the app.
    'docs.middleware.DocMiddleware',         # Get the document.
    'auth.middleware.AuthMiddleware',        # Check access permissions.
]

if USE_APPSTATS:
    MIDDLEWARE_CLASSES.insert(0,
        'google.appengine.ext.appstats.recording.AppStatsDjangoMiddleware')

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
    'docs',
    'blobs',
    'backups',
    'dashboard',
    'utils',
)

if '--with-xunit' in sys.argv:
    INSTALLED_APPS = INSTALLED_APPS + ('django_nose', )
    TEST_RUNNER = 'django_nose.run_tests'

# Combined JavaScript and CSS files
COMBINE_FILES = not DEBUG
#COMBINE_FILES = True
MEDIA_FILES = {
    'js': {
        'pageforest': ['namespace', 'base', 'random', 'cookies',
                       'registration', 'sign-in-form'],
        },

    'css': {
        'default': ['main', 'home', 'form'],
        },
    }

# Exported files - used by external developers
LIB_FILES = {
    'js': {
        'json2': ['json2'],
        'utils': ['namespace', 'base', 'random', 'cookies', 'format',
                  'client'],
        },
    }
