from google.appengine.ext import db


def prefix_filter(query, kind, start, stop=None,
                  property_name='__key__', greater='>=', less='<'):
    """
    Helper function to add a prefix filter to an existing query object.
    """
    if stop is None:
        # Increase the last character of the start value.
        stop = start[:-1] + chr(ord(start[-1]) + 1)
    query.filter(property_name + ' ' + greater, db.Key.from_path(kind, start))
    query.filter(property_name + ' ' + less, db.Key.from_path(kind, stop))
