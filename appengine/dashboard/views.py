from datetime import datetime, timedelta

from utils.shortcuts import render_to_response

from auth.models import User
from data.models import KeyValue


def index(request):
    now = datetime.now()
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    new_users = (
        User.all().filter('joined >', day_ago).count(),
        User.all().filter('joined >', week_ago).count(),
        User.all().filter('joined >', month_ago).count())
    new_data = (
        KeyValue.all().filter('timestamp >', day_ago).count(),
        KeyValue.all().filter('timestamp >', week_ago).count(),
        KeyValue.all().filter('timestamp >', month_ago).count())
    return render_to_response(request, 'dashboard/index.html', locals())
