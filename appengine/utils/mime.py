import os
import mimetypes
import logging

from django.conf import settings

# Override and extend Python's mimetypes module.
MIMETYPES = {
    '.js': 'application/javascript',
    '.json': settings.JSON_MIMETYPE,
    '.ico': 'image/vnd.microsoft.icon',
}

HTML_PREFIXES = ['<!doctype', '<html']


def guess_mimetype(filename, data=None):
    """
    >>> guess_mimetype('index.html')
    'text/html'
    >>> guess_mimetype('static/css/style.css')
    'text/css'
    >>> guess_mimetype('script.js')
    'application/javascript'
    >>> guess_mimetype('logo.png')
    'image/png'
    >>> guess_mimetype('photo.jpg')
    'image/jpeg'
    >>> guess_mimetype('foo')
    'text/plain'
    >>> guess_mimetype('foo', '<HTML>\\n<HEAD')
    'text/html'
    >>> guess_mimetype('foo', '<!DOCTYPE html>\\n<html>\\n')
    'text/html'
    """
    (root, ext) = os.path.splitext(filename.lower())
    if ext in MIMETYPES:
        return MIMETYPES[ext]
    if not mimetypes.inited:
        mimetypes.init()
    if ext in mimetypes.types_map:
        return mimetypes.types_map[ext]

    if data is not None:
        line1 = data.partition('\n')[0].lower()
        for test in HTML_PREFIXES:
            if line1.startswith(test):
                return 'text/html'
    return 'text/plain'


if __name__ == '__main__':
    import doctest
    doctest.testmod()
