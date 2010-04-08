import os
import logging

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
    """
    Make some of the application settings available as template variables.
    """
    from django.conf import settings
    result = {}
    for name in EXPORT_SETTINGS:
        result[name] = getattr(settings, name)
    return result


def combined_files(request):
    """
    Return a dictionary of static js and css files across all applications.
    """
    from django.conf import settings
    result = {}
    for file_type in ['js', 'css']:
        template_key = "%s_files" % file_type
        result[template_key] = {}
        for alias, file_list in settings.FILE_GROUPS[file_type].items():
            result[template_key][alias] = []
            if settings.COMBINE_FILES:
                result[template_key][alias].append("/static/%s/%s_%s.%s" %
                   (file_type, alias, settings.MEDIA_VERSION, file_type))
            else:
                for filename in file_list:
                    result[template_key][alias].append("/static/%s/%s.%s" %
                       (file_type, filename, file_type))

    return result
