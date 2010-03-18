from datetime import datetime, timedelta

from django.shortcuts import render_to_response
from django.template import RequestContext

from auth.models import User
from data.models import KeyValue


def index(request):
    now = datetime.now()
    day_ago = now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    new_users = (
        User.all().filter('created >', day_ago).count(),
        User.all().filter('created >', week_ago).count(),
        User.all().filter('created >', month_ago).count())
    new_data = (
        KeyValue.all().filter('created >', day_ago).count(),
        KeyValue.all().filter('created >', week_ago).count(),
        KeyValue.all().filter('created >', month_ago).count())
    return render_to_response('dashboard/index.html', locals(),
                              context_instance=RequestContext(request))
