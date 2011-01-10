import logging
import re
from datetime import datetime, timedelta
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


#                      1       2       3       4       5       6      7
re_iso = re.compile(r"^(\d{4})-?(\d{2})-?(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{0,6})?Z$")


def datetime_from_iso(iso):
    """
    Convert from ISO 8601 format to a datetime.

    TODO: Allow just date w/o full fractional time - or partial times

    >>> datetime_from_iso("2011-01-07T01:32:13Z")
    datetime.datetime(2011, 1, 7, 1, 32, 13)
    """
    m = re_iso.match(iso)
    if m is None:
        return None
    dt = datetime(year=int(m.group(1)), month=int(m.group(2)), day=int(m.group(3)),
                  hour=int(m.group(4)), minute=int(m.group(5)), second=int(m.group(6)))
    if m.group(7):
        dt += timedelta(microseconds=int(float('0' + m.group(7)) * 1000000))
    logging.info("dt: %r" % dt)
    return dt


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
    def __init__(self, json_dict=None, status=200):
        if json_dict is None:
            json_dict = {}
        if status is not None:
            json_dict['status'] = status
        # We don't want extra spaces after commas since we and
        # embedding newlines there, anyway.
        content = json.dumps(json_dict, sort_keys=True, indent=2,
                             separators=(',', ': '), cls=ModelEncoder)
        # REVIEW: This used to call super(HttpJSONResponse, self) - bug that
        # was generating errors about self not being a derived class???
        HttpResponse.__init__(self, content,
                              mimetype=settings.JSON_MIMETYPE_CS,
                              status=status)


if __name__ == '__main__':
    import doctest
    doctest.testmod()
