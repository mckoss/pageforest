import string
import random
import hmac
import hashlib

SEPARATOR = '|'
HEX = string.hexdigits[:16]  # Without uppercase.
BASE62 = string.uppercase + string.lowercase + string.digits
BASE64 = BASE62 + '+/'
BASE64URL = BASE62 + '-_'


def random64(length=32, chars=BASE64URL):
    """
    >>> len(random64())
    32
    >>> len(random64(16))
    16
    >>> min(random64(10000))
    '-'
    >>> max(random64(10000))
    'z'
    """
    maximum = len(chars) - 1
    return ''.join([chars[random.randint(0, maximum)]
                    for counter in xrange(length)])


def join(*args):
    """
    Join arguments with separator. Special types are converted to
    canonical string representation.

    >>> join('a', 'b', 'c')
    'a|b|c'
    >>> join(1, 2, 3)
    '1|2|3'
    >>> join(['a', 'b', 'c'], 'd')
    'a|b|c|d'
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


def split(signature):
    """
    Split a signature, using the SEPARATOR.

    >>> split('a|b|c')
    ['a', 'b', 'c']
    """
    return signature.split(SEPARATOR)


def hmac_sha1(*args):
    """
    The last item in args is the secret key for HMAC.

    >>> hmac_sha1('a', 'b', 'c')
    'edbb934dd24e2bc149ade2b812aac877b7cb6723'
    """
    args = list(args)
    key = str(args.pop())
    msg = join(*args)
    return hmac.new(key, msg, hashlib.sha1).hexdigest()


def sign(*args):
    """
    The last item in args is the secret key for HMAC.

    >>> sign('a', 'b', 'c')
    'a|b|edbb934dd24e2bc149ade2b812aac877b7cb6723'
    """
    args = list(args)
    args[-1] = hmac_sha1(*args)
    return join(*args)


def verify(signed, key):
    """
    Verify a properly signed string - the last argument is the HMAC.

    >>> verify('a|b|edbb934dd24e2bc149ade2b812aac877b7cb6723', 'c')
    True
    >>> verify(u'a|b|edbb934dd24e2bc149ade2b812aac877b7cb6723', 'c')
    True
    >>> verify(['a', 'b', 'edbb934dd24e2bc149ade2b812aac877b7cb6723'], 'c')
    True
    >>> verify('a|b|edbb934dd24e2bc149ade2b812aac877b7cb6723', 'd')
    False
    >>> verify(u'a|b|edbb934dd24e2bc149ade2b812aac877b7cb6723', 'd')
    False
    >>> verify(['a', 'b', 'edbb934dd24e2bc149ade2b812aac877b7cb6723'], 'd')
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
