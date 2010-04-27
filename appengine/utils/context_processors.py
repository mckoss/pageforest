import settingsauto

SAFE_SETTINGS = """
APPLICATION_ID
CURRENT_VERSION_ID
SERVER_SOFTWARE
AUTH_DOMAIN
SITE_NAME
ANALYTICS_CODE

DEV_APPSERVER
DEBUG
TEMPLATE_DEBUG

ADMINS
MANAGERS
DEFAULT_DOMAIN
DOMAINS

MEDIA_URL
COMBINE_FILES
""".split()


def safe_settings(request):
    """
    Make some of the application settings available as template variables.
    """
    from django.conf import settings
    result = {}
    for name in SAFE_SETTINGS:
        result[name] = getattr(settings, name)
    return result


def combined_files(request):
    """
    Return a dictionary of static js and css files across all applications.
    """
    from django.conf import settings
    result = {}
    for file_type in settings.FILE_GROUPS.keys():
        template_key = "%s_files" % file_type
        result[template_key] = {}
        if file_type == 'js':
            combined_path = settings.LIB_URL + settingsauto.JS_VERSION + '/'
            file_ext = '.min.js'
        else:
            combined_path = settings.MEDIA_URL + settingsauto.MEDIA_VERSION + \
                '/' + file_type + '/'
            file_ext = '.' + file_type

        for alias, file_list in settings.FILE_GROUPS[file_type].items():
            result[template_key][alias] = []
            if settings.COMBINE_FILES:
                result[template_key][alias].append("%s%s%s" %
                   (combined_path, alias, file_ext))
            else:
                # Return list of raw files in the source location
                for filename in file_list:
                    result[template_key][alias].append("%s%s/%s.%s" %
                       (settings.MEDIA_URL, file_type, filename, file_type))

    return result
