from datetime import datetime
from django.http import HttpResponse

import settings

from django.utils import simplejson as json


class ModelEncoder(json.JSONEncoder):
    """
    Encode some common datastore property types to JSON.
    """

    def default(self, obj):
        if isinstance(obj, datetime):
            return {"__class__": "Date",
                    "isoformat": obj.isoformat() + 'Z'}
        return json.JSONEncoder.default(self, obj)


def is_valid_json(data):
    """
    Attempt to parse JSON data, return False if simplejson raised ValueError.

    >>> is_valid_json('{}')
    True
    >>> is_valid_json('{')
    False
    """
    try:
        json.loads(data)
        return True
    except ValueError:
        return False


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


class HttpJSONResponse(HttpResponse):
    def __init__(self, json_dict=None, status=None):
        if json_dict is None:
            json_dict = {}
        if status is None:
            status = 200
        json_dict['status'] = status
        content = json.dumps(json_dict)
        super(HttpJSONResponse, self).__init__(content,
                                               mimetype=settings.JSON_MIMETYPE,
                                               status=status)


if __name__ == '__main__':
    import doctest
    doctest.testmod()
