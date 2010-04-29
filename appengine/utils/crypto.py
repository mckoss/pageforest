import random
import hmac
import hashlib
from datetime import datetime

SEPARATOR = '/'
BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
BASE64 = BASE62 + '+/'
BASE64URL = BASE62 + '-_'


def random64(length=32, chars=BASE64):
    """
    >>> len(random64())
    32
    >>> len(random64(16))
    16
    >>> min(random64(10000))
    '+'
    >>> max(random64(10000))
    'z'
    """
    maximum = len(chars) - 1
    return ''.join([chars[random.randint(0, maximum)]
                    for counter in xrange(length)])


def random64url(length=32):
    """
    >>> min(random64url(10000))
    '-'
    """
    return random64(length, BASE64URL)


def join(*args):
    """
    Join arguments with separator. Special types are converted to
    canonical string representation.

    >>> join('a', 'b', 'c')
    'a/b/c'
    >>> join(1, 2, 3)
    '1/2/3'
    >>> join(['a', 'b', 'c'], 'd')
    'a/b/c/d'
    >>> join(datetime(2010, 4, 19, 9, 24, 56, 123456))
    '2010-04-19T09:24:56Z'
    >>> join(datetime(2010, 4, 19, 9, 24, 56, 987654))
    '2010-04-19T09:24:56Z'
    >>> join(1.0 / 9.0)
    '0.1111111'
    """
    parts = []
    for arg in args:
        if isinstance(arg, datetime):
            arg = arg.isoformat()[:19] + 'Z'
        elif isinstance(arg, float):
            arg = '%.7f' % arg
        elif isinstance(arg, (tuple, list)):
            arg = join(*arg)
        else:
            arg = str(arg)
        parts.append(arg)
    return SEPARATOR.join(parts)


def hmac_sha1(*args):
    """
    The last item in args is the secret key for HMAC.

    >>> hmac_sha1('a', 'b', 'c')
    '353b2e5fb7afb93637bc22480a0fd6365127970b'
    """
    args = list(args)
    key = args.pop()
    msg = join(*args)
    return hmac.new(key, msg, hashlib.sha1).hexdigest()


def sign(*args):
    """
    The last item in args is the secret key for HMAC.

    >>> sign('a', 'b', 'c')
    'a/b/353b2e5fb7afb93637bc22480a0fd6365127970b'
    """
    args = list(args)
    args[-1] = hmac_sha1(*args)
    return join(*args)


if __name__ == '__main__':
    import doctest
    doctest.testmod()
