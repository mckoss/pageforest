def render_to_response(request, template, variables):
    """
    Call Django's render_to_response with a RequestContext.
    """
    import django.shortcuts
    from django.template import RequestContext
    return django.shortcuts.render_to_response(
        template, variables, context_instance=RequestContext(request))


def lookup_or_404(cls, key_name):
    """
    Try to load a model instance. If not found, raise Http404.
    """
    if hasattr(cls, 'lookup'):
        result = cls.lookup(key_name)
    else:
        result = cls.get_by_key_name(key_name)
    if result is None:
        from django.http import Http404
        raise Http404(cls.__name__ + ' not found: ' + key_name)
    return result


def get_int(mapping, key, default=None, min=None, max=None):
    """
    Get an integer value from a dict of strings, if possible.

    >>> get_int({'a': '123'}, 'a')
    123
    >>> get_int({'a': '-123'}, 'a')
    -123
    >>> get_int({'a': '123'}, 'a', min=25)
    123
    >>> get_int({'a': '123'}, 'a', max=999)
    123
    >>> get_int({'a': '123'}, 'a', min=255)
    255
    >>> get_int({'a': '123'}, 'a', max=99)
    99

    If the key does not exist, the default value is returned.

    >>> get_int({'a': '123'}, 'b')
    >>> get_int({'a': '123'}, 'b', 100)
    100
    >>> get_int({'a': '123'}, 'b', 'error')
    'error'

    Default takes precedence over min and max.

    >>> get_int({'a': '123'}, 'b', 100, max=99)
    100
    >>> get_int({'a': '123'}, 'b', 100, min=101)
    100
    """
    if key not in mapping:
        return default
    value = int(mapping[key])
    if min is not None and value < min:
        value = min
    if max is not None and value > max:
        value = max
    return value


def get_bool(mapping, key, default=None):
    """
    Get a boolean value from a dict of strings, if possible.

    >>> get_bool({'a': 'true'}, 'a')
    True
    >>> get_bool({'a': 'True'}, 'a')
    True
    >>> get_bool({'a': 'TRUE'}, 'a')
    True
    >>> get_bool({'a': 'false'}, 'a')
    False
    >>> get_bool({'a': 'False'}, 'a')
    False
    >>> get_bool({'a': 'FALSE'}, 'a')
    False
    >>> get_bool({'a': 'FALSE'}, 'b', True)
    True
    >>> get_bool({'a': 'FALSE'}, 'b', False)
    False
    >>> get_bool({'a': 'yes'}, 'a')
    Traceback (most recent call last):
    ValueError: Expected true or false for a.
    >>> get_bool({'a': 'yes'}, 'a', False)
    Traceback (most recent call last):
    ValueError: Expected true or false for a.
    """
    if key not in mapping:
        return default
    value = mapping[key].lower()
    if value not in ('true', 'false'):
        raise ValueError("Expected true or false for %s." % key)
    return value == 'true'


def project(d, keys):
    """
    Return a dictionary that is the projection of properties
    from the keys list.

    >>> project({}, ['a'])
    {}
    >>> project({'a': 1, 'b': 2}, ['a'])
    {'a': 1}
    >>> project({'a': 1, 'b': 2}, ['b', 'c'])
    {'b': 2}
    """
    result = {}
    for key in keys:
        if key in d:
            result[key] = d[key]
    return result


if __name__ == '__main__':
    import doctest
    doctest.testmod()
