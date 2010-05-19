from datetime import datetime

from django.utils import simplejson as json

ALWAYS_EXCLUDE = ['created_ip', 'modified_ip', 'secret', 'schema']


class DateEncoder(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, datetime):
            return {"__class__": "Date",
                    "isoformat": obj.isoformat() + 'Z'}
        return json.JSONEncoder.default(self, obj)


def model_to_json(entity, extra=None, include=None, exclude=None, indent=2):
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
    result = {}
    for name in entity.properties():
        if name in ALWAYS_EXCLUDE:
            continue
        if exclude and name in exclude:
            continue
        if include and name not in include:
            continue
        result[name] = getattr(entity, name)
    if extra:
        result.update(extra)
    if indent is None:
        separators = (', ', ': ')
    else:
        separators = (',', ': ')
    return json.dumps(result, sort_keys=True, indent=indent,
                      separators=separators, cls=DateEncoder)


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
