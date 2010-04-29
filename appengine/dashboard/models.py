from datetime import datetime, timedelta

from google.appengine.ext import db

from utils.mixins import Cacheable, Migratable

from auth.models import User
from apps.models import App
from documents.models import Document
from storage.models import KeyValue

PROPERTIES = ['users', 'apps', 'documents', 'keyvalues']


def count(model, property, start, stop):
    query = model.all(keys_only=True)
    query.filter(property + ' >=', start)
    query.filter(property + ' <', stop)
    return query.count()


class StatsHour(Cacheable, Migratable):
    """
    Collect statistics for one hour.
    The key name is YYYYMMDDHH.
    """
    users = db.IntegerProperty()
    apps = db.IntegerProperty()
    documents = db.IntegerProperty()
    keyvalues = db.IntegerProperty()

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
        self.users = count(User, 'created', start, stop)
        self.apps = count(App, 'created', start, stop)
        self.documents = count(Document, 'created', start, stop)
        self.keyvalues = count(KeyValue, 'created', start, stop)

    def __unicode__(self):
        result = []
        for property in PROPERTIES:
            result.append('%d %s' % (getattr(self, property), property))
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
        for property in PROPERTIES:
            count = 0
            for part in parts:
                if part:
                    count += getattr(part, property)
            setattr(self, property, count)


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
