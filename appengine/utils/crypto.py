import random
from hashlib import sha1, md5
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

    >>> canonical(datetime(2010, 4, 19, 9, 24, 56))
    '2010-04-19T09:24:56Z'
    >>> canonical(1.0 / 9.0)
    '0.1111111'
    """
    if isinstance(value, datetime):
        return value.isoformat() + 'Z'
    if isinstance(value, float):
        return '%.7f' % value
    return str(value)


def join(*args, **kwargs):
    """
    >>> join('a', 'b', 'c', separator=',')
    'a,b,c'
    >>> join('a', 'b+c', 'd', separator='+')
    Traceback (most recent call last):
    ValueError: Found separator '+' inside string value.
    """
    separator = kwargs.get('separator', SEPARATOR)
    args = [canonical(arg) for arg in args]
    for arg in args:
        if separator in arg:
            raise ValueError(
                "Found separator '%s' inside string value." % separator)
    return separator.join(args)


def hash(*args, **kwargs):
    """
    >>> hash('a', 'b', 'c', separator=',')
    '9caa91157421e243281346b0bf7a82b5200e67e2'
    """
    return sha1(join(*args, **kwargs)).hexdigest()


def sign(*args, **kwargs):
    """
    >>> sign('a', 'b', 'c', separator=',')
    'a,b,9caa91157421e243281346b0bf7a82b5200e67e2'
    """
    args = list(args)
    args[-1] = hash(*args, **kwargs)
    return join(*args, **kwargs)


if __name__ == '__main__':
    import doctest
    doctest.testmod()
