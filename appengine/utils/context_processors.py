EXPORT_SETTINGS = 'ADMINS MEDIA_URL MEDIA_VERSION'.split()


def settings(request):
    from django.conf import settings
    result = {}
    for name in EXPORT_SETTINGS:
        result[name] = getattr(settings, name)
    return result
