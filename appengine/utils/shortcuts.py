def render_to_response(request, template, variables):
    """
    Call Django's render_to_response with a RequestContext.
    """
    import django.shortcuts
    from django.template import RequestContext
    return django.shortcuts.render_to_response(
        template, variables, context_instance=RequestContext(request))


def get_int(dictionary, key, default=None, min=None, max=None):
    """
    Get an int value from a dict of strings, if possible.

    >>> get_int({'a': '123'}, 'a')
    123
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
    if key not in dictionary:
        return default
    value = dictionary[key]
    if not value.isdigit():
        return default
    value = int(value)
    if min is not None and value < min:
        value = min
    if max is not None and value > max:
        value = max
    return value


if __name__ == '__main__':
    import doctest
    doctest.testmod()
