from datetime import datetime, timedelta

from google.appengine.ext import db

from utils.mixins import Migratable, Cacheable

from auth.models import User
from apps.models import App
from docs.models import Doc
from blobs.models import Blob

PROPERTIES = ['users', 'apps', 'docs', 'blobs']


def count_entities(model, property_name, start, stop):
    """
    Count all entities of this model with a DatetimeProperty between
    start (inclusive) and stop (exclusive).
    """
    query = model.all(keys_only=True)
    query.filter(property_name + ' >=', start)
    query.filter(property_name + ' <', stop)
    return query.count()


class StatsHour(Migratable, Cacheable):
    """
    Collect statistics for one hour.
    The key name is YYYYMMDDHH.
    """
    users = db.IntegerProperty()
    apps = db.IntegerProperty()
    docs = db.IntegerProperty()
    blobs = db.IntegerProperty()

    def start_time(self):
        key_name = self.key().name()
        year = int(key_name[0:4])
        month = int(key_name[4:6])
        day = int(key_name[6:8])
        hour = int(key_name[8:10])
        return datetime(year, month, day, hour)

    def update(self):
        start = self.start_time()
        stop = start + timedelta(hours=1)
        self.users = count_entities(User, 'created', start, stop)
        self.apps = count_entities(App, 'created', start, stop)
        self.docs = count_entities(Doc, 'created', start, stop)
        self.blobs = count_entities(Blob, 'created', start, stop)

    def __unicode__(self):
        result = []
        for property_name in PROPERTIES:
            result.append('%d %s' % (
                    getattr(self, property_name), property_name))
        return ', '.join(result)


class StatsDay(StatsHour):
    """
    Collect statistics for one day (UTC).
    The key name is YYYYMMDD.
    """

    def get_parts(self):
        key_name = self.key().name()
        keys = [db.Key.from_path('StatsHour', key_name + '%02d' % hour)
                for hour in range(24)]
        return db.get(keys)

    def update(self):
        parts = self.get_parts()
        for property_name in PROPERTIES:
            count = 0
            for part in parts:
                if part:
                    count += getattr(part, property_name)
            setattr(self, property_name, count)


class StatsMonth(StatsDay):
    """
    Collect statistics for one month (UTC).
    The key name is YYYYMM.
    """

    def get_parts(self):
        key_name = self.key().name()
        keys = [db.Key.from_path('StatsDay', key_name + '%02d' % day)
                for day in range(1, 32)]
        return db.get(keys)
