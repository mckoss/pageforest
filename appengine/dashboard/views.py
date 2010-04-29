from datetime import datetime, timedelta

from utils.shortcuts import render_to_response

from auth.models import User
from apps.models import App
from documents.models import Document
from storage.models import KeyValue


def count_recent(model, property, start_times):
    return [model.all().filter(property + ' >', start_time).count()
            for start_time in start_times]


def index(request):
    """
    Dashboard overview.
    """
    now = datetime.now()
    start_times = [
        now - timedelta(hours=24),
        now - timedelta(days=7),
        now - timedelta(days=30),
        ]
    keyvalue_created = count_recent(KeyValue, 'created', start_times)
    keyvalue_modified = count_recent(KeyValue, 'modified', start_times)
    for index in range(len(keyvalue_modified)):
        keyvalue_modified[index] -= keyvalue_created[index]
    dictionary = {
        'user_joined': count_recent(User, 'date_joined', start_times),
        'app_created': count_recent(App, 'created', start_times),
        'document_created': count_recent(Document, 'created', start_times),
        'keyvalue_created': keyvalue_created,
        'keyvalue_modified': keyvalue_modified,
        }
    return render_to_response(request, 'dashboard/index.html', dictionary)
