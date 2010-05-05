import random
import hmac
import hashlib

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
    >>> join(1.0 / 9.0)
    '0.1111111'
    """
    parts = []
    for arg in args:
        if isinstance(arg, float):
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
    key = str(args.pop())
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


def verify(signed, key):
    """
    Verify a properly signed string - the last argument is the HMAC.

    >>> verify('a/b/353b2e5fb7afb93637bc22480a0fd6365127970b', 'c')
    True
    >>> verify(u'a/b/353b2e5fb7afb93637bc22480a0fd6365127970b', 'c')
    True
    >>> verify(['a', 'b', '353b2e5fb7afb93637bc22480a0fd6365127970b'], 'c')
    True
    >>> verify('a/b/353b2e5fb7afb93637bc22480a0fd6365127970b', 'd')
    False
    >>> verify(u'a/b/353b2e5fb7afb93637bc22480a0fd6365127970b', 'd')
    False
    >>> verify(['a', 'b', '353b2e5fb7afb93637bc22480a0fd6365127970b'], 'd')
    False
    """
    if isinstance(signed, basestring):
        parts = signed.split(SEPARATOR)
    else:
        parts = list(signed)
        signed = SEPARATOR.join(parts)
    if len(parts) < 2:
        return False
    parts[-1] = key
    return signed == sign(*parts)


if __name__ == '__main__':
    import doctest
    doctest.testmod()
