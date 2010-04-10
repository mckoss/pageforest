QUOTES = ['"', "'"]


def load(text):
    r"""
    Read text from a settings file, return a dict.

    >>> load('MEDIA_VERSION = 14')
    {'MEDIA_VERSION': 14}

    >>> load("CSS_HASH = 'abc'")
    {'CSS_HASH': 'abc'}

    >>> load('CSS_HASH = "abc"')
    {'CSS_HASH': 'abc'}

    >>> load('# Comment')
    {'# Comment': ''}

    >>> load('# Comment\n\nA =1\nB =C\n')
    {'A': 1, 'B': 'C', '# Comment': ''}
    """
    settings = {}
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if '=' in line:
            key, value = line.split('=', 1)
            key = key.rstrip()
            value = value.lstrip()
        else:
            key = line
            value = ''
        if value and value[0] in QUOTES and value[0] == value[-1]:
            value = value[1:-1]
        elif value.isdigit():
            value = int(value)
        settings[key] = value
    return settings


def save(settings):
    r"""
    Serialize a dict to settings file text.

    >>> save({'MEDIA_VERSION': 14})
    'MEDIA_VERSION = 14\n'

    >>> save({'CSS_HASH': 'abc'})
    "CSS_HASH = 'abc'\n"

    >>> save({'# Comment': ''})
    '# Comment\n'

    >>> save({'MEDIA_VERSION': 14, '# Comment': '', 'CSS_HASH': 'abc'})
    "# Comment\nCSS_HASH = 'abc'\nMEDIA_VERSION = 14\n"
    """
    keys = settings.keys()
    keys.sort()
    lines = []
    for key in keys:
        if key.startswith('#'):
            lines.append(key)
        else:
            value = settings[key]
            if isinstance(value, basestring):
                value = "'%s'" % value
            lines.append('%s = %s' % (key, value))
    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    import doctest
    doctest.testmod()
