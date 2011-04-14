from datetime import datetime, timedelta

from django import template

register = template.Library()


def plural(number):
    """
    >>> plural(0)
    's'
    >>> plural(1)
    ''
    >>> plural(2)
    's'
    """
    return number != 1 and 's' or ''


def ago(delta):
    """
    Format a interval as a human-readable "age".

    >>> ago(timedelta(days=-1))
    'in the future'
    >>> ago(timedelta(days=800))
    '2 years ago'
    >>> ago(timedelta(days=400))
    '1 year ago'
    >>> ago(timedelta(days=300))
    '9 months ago'
    >>> ago(timedelta(days=80))
    '80 days ago'
    >>> ago(timedelta(hours=48))
    '2 days ago'
    >>> ago(timedelta(hours=47))
    'yesterday'
    >>> ago(timedelta(hours=24))
    'yesterday'
    >>> ago(timedelta(hours=23))
    '23 hours ago'
    >>> ago(timedelta(minutes=60))
    '1 hour ago'
    >>> ago(timedelta(minutes=59))
    '59 minutes ago'
    >>> ago(timedelta(seconds=60))
    '1 minute ago'
    >>> ago(timedelta(seconds=59))
    'seconds ago'
    """
    if delta.days < 0:
        return "in the future"

    years = int(delta.days / 365)
    if years >= 1:
        return "%d year%s ago" % (years, plural(years))

    months = int(delta.days * 12 / 365)
    if months >= 3:
        return "%d months ago" % months

    if delta.days == 1:
        return "yesterday"
    if delta.days > 1:
        return "%d days ago" % delta.days

    hrs = int(delta.seconds / 60 / 60)
    if hrs >= 1:
        return "%d hour%s ago" % (hrs, plural(hrs))

    minutes = round(delta.seconds / 60)
    if minutes < 1:
        return "seconds ago"

    return "%d minute%s ago" % (minutes, plural(minutes))


@register.filter(name='ago')
def datetime_ago(dt):
    delta = datetime.now() - dt
    return ago(delta)


def hexdump(bytes, row=16):
    """
    >>> hexdump('123456789', 6)
    31 32 33 34 35 36 '123456'
    37 38 39 '789'
    """
    while bytes:
        for char in bytes[:row]:
            print '%02x' % ord(char),
        print repr(bytes[:row])
        bytes = bytes[row:]


if __name__ == '__main__':
    import doctest
    doctest.testmod()
