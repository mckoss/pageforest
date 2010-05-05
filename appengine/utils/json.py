from datetime import datetime

from django.utils import simplejson as json


def model_to_json(entity, extra=None, include=None, exclude=None):
    """
    Serialize a datastore entity to JSON.

    >>> from google.appengine.ext import db
    >>> class Example(db.Model):
    ...     text = db.StringProperty()
    ...     number = db.IntegerProperty()
    >>> print model_to_json(Example(text='abc', number=123))
    {
    "number": 123,
    "text": "abc"
    }
    """
    mapping = {}
    for name in entity.properties():
        if include and name not in include:
            continue
        if exclude and name in exclude:
            continue
        mapping[name] = getattr(entity, name)
    if extra:
        mapping.update(extra)
    lines = []
    keys = mapping.keys()
    keys.sort()
    for key in keys:
        value = mapping[key]
        if isinstance(value, datetime):
            value = {"__class__": "Date",
                     "isoformat": value.isoformat() + 'Z'}
        value = json.dumps(value, sort_keys=True)
        lines.append('"%s": %s' % (key, value))
    return '{\n' + ',\n'.join(lines) + '\n}'


def assert_string(key, value):
    """
    Check that the value is a string.
    """
    if not isinstance(value, basestring):
        raise ValueError("Expected string value for %s." % key)


def assert_string_list(key, value):
    """
    Check that the value is a list of strings.
    """
    if not isinstance(value, list):
        raise ValueError("Expected string list for %s." % key)
    for item in value:
        if not isinstance(item, basestring):
            raise ValueError("Expected string values inside %s list." % key)


if __name__ == '__main__':
    import doctest
    doctest.testmod()
