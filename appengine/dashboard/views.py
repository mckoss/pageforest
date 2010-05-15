import random
import string
from datetime import datetime, timedelta

from google.appengine.ext import db

from utils.shortcuts import render_to_response

from dashboard.models import StatsHour, StatsDay, StatsMonth

SPARKLINE_HOURS = 14 * 24  # Two weeks.
ENCODING = string.uppercase + string.lowercase + string.digits + '.-'


def sparkline(hours, property_name):
    values = []
    for hour in hours:
        if hour is None:
            values.append(0)
        else:
            values.append(getattr(hour, property_name, None))
    maximum = max(values)
    divider = max(10, maximum)
    chars = []
    radix = len(ENCODING)
    max_index = 0
    for index in range(len(values)):
        value = values[index] or 0
        if value == maximum:
            max_index = index
        value = value * 4095 / divider
        chars.append(ENCODING[value / radix] +
                     ENCODING[value % radix])
    return ''.join(chars), maximum, max_index


def chart(hours, property_name, color):
    (chars, maximum, max_index) = sparkline(hours, property_name)
    horizontal_offset = 0
    if maximum > 8:
        horizontal_offset = -10
    return '&'.join([
            'http://chart.apis.google.com/chart?cht=ls',
            'chs=460x80',       # Size in pixels.
            'chf=bg,s,000000',  # Black background.
            'chco=' + color,    # Foreground.
            'chls=3',           # Line width in pixels.
            'chm=t%d,%s,0,%d,14,,h:%d:6' % (  # Marker label for maximum.
                maximum, color, max_index, horizontal_offset),
            'chd=e:' + chars,
            ])


def simple_date(date):
    return ' '.join((date.strftime('%b'),
                     date.strftime('%d').lstrip('0')))


def dashboard(request):
    """
    Dashboard overview.
    """
    now = datetime.now()
    keys = []
    for ago in range(SPARKLINE_HOURS):
        start_time = now - timedelta(hours=ago)
        name = start_time.strftime('%Y%m%d%H')
        key = db.Key.from_path('StatsHour', name)
        keys.insert(0, key)
    hours = db.get(keys)
    today = datetime.now()
    start = today - timedelta(hours=SPARKLINE_HOURS)
    dictionary = {
        'users_chart': chart(hours, 'users', '00FF00'),
        'apps_chart': chart(hours, 'apps', '0080FF'),
        'docs_chart': chart(hours, 'docs', 'FFFF00'),
        'blobs_chart': chart(hours, 'blobs', 'FF0000'),
        'start_date': simple_date(start),
        'today_date': simple_date(today),
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
