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


def update_jsonp_response(request, response):
    """
    Force a JSON formatted response if callback is used
    """
    if 'callback' not in request.GET:
        return response

    # Do nothing if already encoded as javascript
    if response['Content-Type'] == 'application/javascript':
        return response

    content = response.content

    # Encode arbitrary strings as valid JSON.
    if response['Content-Type'] != settings.JSON_MIMETYPE_CS:
        # Remove trailing newlines.
        content = content.rstrip('\n')
        content = json.dumps(content)

    # Add the requested callback function and javascript mime type
    response.content = request.GET['callback'] + '(' + content + ')'
    response['Content-Type'] = 'application/javascript'
    response.status_code = 200

    return response


re_iso = re.compile(r"^(?P<year>\d{4})-?(?P<month>\d{2})?-?(?P<day>\d{2})?"
                    r"T?(?P<hour>\d{2})?:?(?P<min>\d{2})?:?(?P<sec>\d{2})?(?P<frac>\.\d{0,6})?Z?$")


def datetime_from_iso(iso):
    """
    Convert from ISO 8601 format to a datetime.

    We are lenient in allowing partial dates (optional month, day, and times).
    Fixed-length versions of ISO 8601 (w/o separators) are also allowed.

    Times are assumed to be in Z timezone.

    TODO: Allow other numeric time zones and convert to GMT.

    >>> datetime_from_iso("2011-01-07T01:32:13Z")
    datetime.datetime(2011, 1, 7, 1, 32, 13)
    >>> datetime_from_iso("2011-01-07")
    datetime.datetime(2011, 1, 7, 0, 0)
    >>> datetime_from_iso("20110107")
    datetime.datetime(2011, 1, 7, 0, 0)
    >>> datetime_from_iso("2011-01-07T01:32")
    datetime.datetime(2011, 1, 7, 1, 32)
    >>> datetime_from_iso("2011-01-07T01:32:13.123Z")
    datetime.datetime(2011, 1, 7, 1, 32, 13, 123000)
    >>> datetime_from_iso("2011-01-07T01:32:13.123456Z")
    datetime.datetime(2011, 1, 7, 1, 32, 13, 123456)
    >>> datetime_from_iso("2011")
    datetime.datetime(2011, 1, 1, 0, 0)
    >>> datetime_from_iso("2011-02")
    datetime.datetime(2011, 2, 1, 0, 0)
    >>> datetime_from_iso("20110107013213")
    datetime.datetime(2011, 1, 7, 1, 32, 13)
    >>> datetime_from_iso("2010-1-1") == None
    True
    """
    m = re_iso.match(iso)
    if m is None:
        return None
    year = int(m.group('year'))
    month = int(m.group('month') or 1)
    day = int(m.group('day') or 1)
    hour = int(m.group('hour') or 0)
    minutes = int(m.group('min') or 0)
    seconds = int(m.group('sec') or 0)
    dt = datetime(year, month, day, hour, minutes, seconds)
    if m.group('frac'):
        dt += timedelta(microseconds=int(float('0' + m.group('frac')) * 1000000))
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
