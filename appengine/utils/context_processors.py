def safe_settings(request):
    """
    Make some of the application settings available as template variables.
    """
    from django.conf import settings
    result = {}
    for name in settings.SAFE_SETTINGS:
        result[name] = getattr(settings, name)
    return result


def combined_files(request):
    """
    Return a dictionary of static js and css files.
    """
    from django.conf import settings
    result = {}
    for file_type in settings.MEDIA_FILES.keys():
        template_key = "%s_files" % file_type
        result[template_key] = {}
        combined_path = settings.MEDIA_URL + settings.MEDIA_VERSION + \
            '/' + file_type + '/'
        if file_type == 'js':
            file_ext = '.min.js'
        else:
            file_ext = '.' + file_type

        for alias, file_list in settings.MEDIA_FILES[file_type].items():
            result[template_key][alias] = []
            if settings.COMBINE_FILES:
                result[template_key][alias].append("%s%s%s" %
                   (combined_path, alias, file_ext))
            else:
                # Return list of raw files in the source location
                for filename in file_list:
                    result[template_key][alias].append("%ssrc/%s/%s.%s" %
                       (settings.MEDIA_URL, file_type, filename, file_type))

    return result
