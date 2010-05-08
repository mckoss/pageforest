from datetime import datetime, timedelta

from google.appengine.ext import db

from utils.shortcuts import render_to_response
from utils.crypto import BASE62

from dashboard.models import StatsHour, StatsDay, StatsMonth


def sparkline(hours, property_name):
    values = []
    for hour in hours:
        if hour is None:
            values.append(None)
        else:
            values.append(getattr(hour, property_name, None))
    scale_percent = 100
    maximum = max(values)
    if maximum > 61:
        scale_percent = 6100 / maximum  # Rescale for single-letter encoding.
    chars = []
    for index in range(len(values)):
        if values[index] is None:
            chars.append('A')
        else:
            chars.append(BASE62[values[index] * scale_percent / 100])
    return ''.join(chars)


def chart(hours, property_name, color):
    return '&'.join([
            'http://chart.apis.google.com/chart?cht=ls',
            'chs=400x40',       # Size in pixels.
            'chf=bg,s,000000',  # Black background.
            'chco=' + color,    # Foreground.
            'chls=3',           # Line width in pixels.
            'chd=s:' + sparkline(hours, property_name),
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
        'apps_chart': chart(hours, 'apps', '0000FF'),
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
