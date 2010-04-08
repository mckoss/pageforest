EXPORT_SETTINGS = """
APPLICATION_ID
CURRENT_VERSION_ID
SERVER_SOFTWARE
AUTH_DOMAIN

DEV_APPSERVER
DEBUG
TEMPLATE_DEBUG

ADMINS
MANAGERS
DEFAULT_DOMAIN
DOMAINS

MEDIA_URL
MEDIA_VERSION
COMBINE_FILES
""".split()


def settings(request):
    from django.conf import settings
    result = {}
    for name in EXPORT_SETTINGS:
        result[name] = getattr(settings, name)
    return result
