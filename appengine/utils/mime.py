import os
import mimetypes

# Override and extend Python's mimetypes module.
MIMETYPES = {
    '.js': 'application/javascript',
    '.ico': 'image/vnd.microsoft.icon',
    '.json': 'application/json',
}


def guess_mimetype(filename):
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
    """
    (name, ext) = os.path.splitext(filename.lower())
    if ext in MIMETYPES:
        return MIMETYPES[ext]
    if not mimetypes.inited:
        mimetypes.init()
    if ext in mimetypes.types_map:
        return mimetypes.types_map[ext]
    return 'text/plain'


if __name__ == '__main__':
    import doctest
    doctest.testmod()
