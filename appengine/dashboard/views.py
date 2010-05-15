import random
import string
from datetime import datetime, timedelta

from google.appengine.ext import db

from utils.shortcuts import render_to_response

from dashboard.models import StatsHour, StatsDay, StatsMonth

ENCODING = string.uppercase + string.lowercase + string.digits + '.-'


def smooth(values):
    for i in range(len(values)):
        avg = int(sum([values[i - j] for j in range(10)]) / 10)
        yield max(0, avg)


def sparkline(hours, property_name):
    values = []
    for hour in hours:
        if hour is None:
            values.append(random.randint(-100, 200))
        else:
            values.append(getattr(hour, property_name, None))
    values = list(smooth(values))
    maximum = max(values)
    divider = max(10, maximum)
    chars = []
    radix = len(ENCODING)
    for index in range(len(values)):
        value = values[index] or 0
        value = value * 4095 / divider
        chars.append(ENCODING[value / radix] +
                     ENCODING[value % radix])
    return ''.join(chars), values.index(maximum)


def chart(hours, property_name, color):
    (chars, max_index) = sparkline(hours, property_name)
    title_vertical = (ENCODING.index(chars[0]) * len(ENCODING) +
                      ENCODING.index(chars[1]))
    return '&'.join([
            'http://chart.apis.google.com/chart?cht=ls',
            'chs=480x100',      # Size in pixels.
            'chf=bg,s,000000',  # Black background.
            'chco=' + color,    # Foreground.
            'chls=3',           # Line width in pixels.
            'chma=0,0,0,20',   # Left, right, top, bottom margins.
            'chm=tNew+%s,%s,0,0,16,,t::%s|N*f0*,%s,0,%d,16,,:10' % (
                property_name, color, -title_vertical * 80 / 4095 - 2,
                color, max_index),
            'chd=e:' + chars,
            ])


def dashboard(request):
    """
    Dashboard overview.
    """
    now = datetime.now()
    keys = []
    for ago in range(24 * 7):
        start_time = now - timedelta(hours=ago)
        name = start_time.strftime('%Y%m%d%H')
        key = db.Key.from_path('StatsHour', name)
        keys.insert(0, key)
    hours = db.get(keys)
    dictionary = {
        'users_chart': chart(hours, 'users', '00FF00'),
        'apps_chart': chart(hours, 'apps', '0080FF'),
        'docs_chart': chart(hours, 'docs', 'FFFF00'),
        'blobs_chart': chart(hours, 'blobs', 'FF0000'),
        }
    return render_to_response(request, 'dashboard/index.html', dictionary)


def cron(request, date=None):
    """
    Update statistics for the current hour, day, month.
    """
    if date is None:
        now = datetime.now() - timedelta(minutes=30)
    else:
        date = date.strip('/')
        while len(date) < 10:
            date += '01'
        now = datetime.strptime(date, '%Y%m%d%H')
    # Update current hour.
    hour = StatsHour(key_name=now.strftime('%Y%m%d%H'))
    hour.update()
    hour.put()
    # Update current day.
    day = StatsDay(key_name=now.strftime('%Y%m%d'))
    day.update()
    day.put()
    # Update current month.
    month = StatsMonth(key_name=now.strftime('%Y%m'))
    month.update()
    month.put()
    return render_to_response(request, 'dashboard/cron.html', {
            'hour': hour, 'day': day, 'month': month})
