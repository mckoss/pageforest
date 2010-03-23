from django.utils import simplejson


def probably_valid_json(text):
    """
    Helper function to check if a string looks like valid JSON.
    However, this only looks at a few first and last characters,
    and is much more efficient than actually loading large data.

    >>> probably_valid_json('8') and probably_valid_json('-8')
    True
    >>> probably_valid_json('""') and probably_valid_json('"abc"')
    True
    >>> probably_valid_json('[]') and probably_valid_json('{}')
    True
    >>> probably_valid_json('[[') or probably_valid_json('()')
    False
    >>> probably_valid_json('-') or probably_valid_json('"')
    False
    >>> probably_valid_json('abc') or probably_valid_json('abc123')
    False
    """
    if not text:
        return False
    if not isinstance(text, basestring):
        return False
    if text[0] == '{' and text[-1] == '}':
        return True  # Object.
    if text[0] == '[' and text[-1] == ']':
        return True  # Array.
    if len(text) > 1 and text[0] == '"' and text[-1] == '"':
        return True  # String.
    if text[0].isdigit() and text[-1].isdigit():
        return True  # Number.
    if len(text) > 1 and text[0] == '-' and \
            text[1].isdigit() and text[-1].isdigit():
        return True  # Negative number.
    if text in ('true', 'false', 'null'):
        return True
    return False


if __name__ == '__main__':
    import doctest
    doctest.testmod()
