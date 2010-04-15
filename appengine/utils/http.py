from calendar import timegm
from email.Utils import formatdate
from datetime import datetime, timedelta, tzinfo

from django.http import HttpResponse


def http_datetime(dt):
    """
    >>> http_datetime(datetime(1994, 11, 15, 12, 45, 26))
    'Tue, 15 Nov 1994 12:45:26 GMT'

    >>> class PST(tzinfo):
    ...     def utcoffset(self, dt):
    ...         return timedelta(minutes=-420)
    >>> http_datetime(datetime(2010, 12, 31, 20, tzinfo=PST()))
    'Sat, 01 Jan 2011 03:00:00 GMT'
    """
    return formatdate(timegm(dt.utctimetuple()))[:26] + 'GMT'


class HttpResponseCreated(HttpResponse):
    status_code = 201

    def __init__(self, location):
        HttpResponse.__init__(self)
        self['Location'] = location


if __name__ == '__main__':
    import doctest
    doctest.testmod()
