from calendar import timegm
from email.Utils import formatdate
from datetime import datetime

from django.http import HttpResponse


def http_datetime(dt):
    """
    >>> http_datetime(datetime(1994, 11, 15, 12, 45, 26))
    'Tue, 15 Nov 1994 12:45:26 GMT'
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
