import random
import hmac
import hashlib
from datetime import datetime

SEPARATOR = '$'
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


def canonical(value):
    """
    Convert special types to canonical string representation.

    >>> canonical(datetime(2010, 4, 19, 9, 24, 56, 123456))
    '2010-04-19T09:24:56Z'
    >>> canonical(1.0 / 9.0)
    '0.1111111'
    """
    if isinstance(value, datetime):
        return value.isoformat()[:19] + 'Z'
    if isinstance(value, float):
        return '%.7f' % value
    return str(value)


def join(*args, **kwargs):
    """
    >>> join('a', 'b', 'c', separator=',')
    'a,b,c'
    """
    separator = kwargs.get('separator', SEPARATOR)
    args = [canonical(arg) for arg in args]
    return separator.join(args)


def hash(*args, **kwargs):
    """
    The last item in args is the secret key for HMAC.

    >>> hash('a', 'b', 'c', separator=',')
    '35f2e8a17d82aa42e207df72ac786c84b98a220f'
    """
    args = list(args)
    key = args.pop()
    msg = join(*args, **kwargs)
    return hmac.new(key, msg, hashlib.sha1).hexdigest()


def sign(*args, **kwargs):
    """
    The last item in args is the secret key for HMAC.

    >>> sign('a', 'b', 'c', separator=',')
    'a,b,35f2e8a17d82aa42e207df72ac786c84b98a220f'
    """
    args = list(args)
    key = args.pop()
    msg = join(*args, **kwargs)
    args.append(hmac.new(key, msg, hashlib.sha1).hexdigest())
    return join(*args, **kwargs)


if __name__ == '__main__':
    import doctest
    doctest.testmod()
