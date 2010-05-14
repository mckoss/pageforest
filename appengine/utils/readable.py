from datetime import datetime, timedelta


def plural(number):
    return number != 1 and 's' or ''


def interval(delta):
    """
    Format a interval as a human-readable "age".

    >>> interval(timedelta(days=800))
    '2 years ago'
    >>> interval(timedelta(days=400))
    '1 year ago'
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
