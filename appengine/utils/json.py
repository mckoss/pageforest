from datetime import datetime

from django.utils import simplejson as json

ALWAYS_EXCLUDE = ['created_ip', 'modified_ip', 'secret', 'schema']


def model_to_json(entity, extra=None, include=None, exclude=None):
    """
    Serialize a datastore entity to JSON.

    >>> from google.appengine.ext import db
    >>> class Example(db.Model):
    ...     text = db.StringProperty()
    ...     number = db.IntegerProperty()
    ...     timestamp = db.DateTimeProperty()
    >>> print model_to_json(Example(text='abc', number=123,
    ...     timestamp=datetime(2010, 5, 5, 9, 3, 37)))
    {
      "number": 123,
      "text": "abc",
      "timestamp": {
        "__class__": "Date",
        "isoformat": "2010-05-05T09:03:37Z"
      }
    }
    """
    mapping = {}
    for name in entity.properties():
        if name in ALWAYS_EXCLUDE:
            continue
        if exclude and name in exclude:
            continue
        if include and name not in include:
            continue
        value = getattr(entity, name)
        if isinstance(value, datetime):
            value = {"__class__": "Date",
                     "isoformat": value.isoformat() + 'Z'}
        mapping[name] = value
    if extra:
        mapping.update(extra)
    return json.dumps(mapping, sort_keys=True, indent=2,
                      separators=(',', ': '))


def assert_boolean(key, value):
    """
    Check that the value is True or False.

    >>> assert_boolean('selected', True)
    >>> assert_boolean('selected', False)
    >>> assert_boolean('selected', None)
    Traceback (most recent call last):
    ValueError: Expected true or false for selected.
    """
    if value not in (True, False):
        raise ValueError("Expected true or false for %s." % key)


def assert_string(key, value):
    """
    Check that the value is a string.

    >>> assert_string('five', '5')
    >>> assert_string('five', 5)
    Traceback (most recent call last):
    ValueError: Expected string value for five.
    """
    if not isinstance(value, basestring):
        raise ValueError("Expected string value for %s." % key)


def assert_string_list(key, value):
    """
    Check that the value is a list of strings.

    >>> assert_string_list('five', ['5'])
    >>> assert_string_list('five', [5])
    Traceback (most recent call last):
    ValueError: Expected string values inside five list.
    """
    if not isinstance(value, list):
        raise ValueError("Expected string list for %s." % key)
    for item in value:
        if not isinstance(item, basestring):
            raise ValueError("Expected string values inside %s list." % key)


if __name__ == '__main__':
    import doctest
    doctest.testmod()
