import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'

from google.appengine.dist import use_library
use_library('django', '1.1')

# Force Django to reload its settings.
from django.conf import settings
settings._target = None

if __name__ == '__main__':
    import google.appengine.ext.appstats.ui
    google.appengine.ext.appstats.ui.main()
