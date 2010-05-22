import logging
import zipfile
from StringIO import StringIO
from datetime import datetime

from django.http import HttpResponse

from utils.shortcuts import render_to_response, lookup_or_404

from auth.models import User
from apps.models import App
from docs.models import Doc
from blobs.models import Blob
from backups.models import Backup


def index(request):
    groups = []
    for model in ('User', 'App', 'Doc', 'Blob'):
        query = Backup.all().filter('model', model).order('-youngest')
        backups = query.fetch(20)
        groups.append((model, backups))
    return render_to_response(request, 'backups/index.html',
                              {'groups': groups})


def download(request, key_name):
    backup = lookup_or_404(Backup, key_name)
    response = HttpResponse(backup.zipfile, content_type='application/zip')
    response['Content-Disposition'] = 'attachment'
    return response


def backup_users(request):
    return incremental_backup(request, User, 400)


def backup_apps(request):
    return incremental_backup(request, App, 400)


def backup_docs(request):
    return incremental_backup(request, Doc, 200)


def backup_blobs(request):
    return incremental_backup(request, Blob, 200)


def incremental_backup(request, model, limit):
    """
    Save recently modified entities to a zipfile for backup. The model
    (e.g. User, App, Document, Blob) must have a to_backup method that
    returns a string for each entity.
    """
    kind = model.kind()
    if hasattr(model, 'to_backup'):
        serialize = model.to_backup
    elif hasattr(model, 'to_json'):
        serialize = model.to_json
    elif hasattr(model, 'to_protobuf'):
        serialize = model.to_protobuf
    elif hasattr(model, 'to_xml'):
        serialize = model.to_xml
    else:
        raise NotImplementedError("%s model cannot be serialized." % kind)
    # Find the latest backup timestamp for this kind.
    query = Backup.all().filter('model', kind).order('-youngest')
    fetched = query.fetch(1)
    if fetched:
        youngest = fetched[0].youngest
    else:
        youngest = datetime(2010, 1, 1)
    # Find all entities that were modified since the last backup.
    entities = model.all().filter('modified >', youngest).fetch(limit)
    if not entities:
        return HttpResponse("No %ss modified since %s." % (
                kind.lower(), youngest.isoformat()), content_type='text/plain')
    # Generate a zip file that contains a file for each modified user.
    temp = StringIO()
    archive = zipfile.ZipFile(temp, 'w', zipfile.ZIP_DEFLATED)
    key_name = '%ss-%s.zip' % (
        kind.lower(), datetime.now().strftime('%y%m%d-%H%M%S'))
    backup = Backup(
        key_name=key_name,
        model=kind,
        oldest=datetime(2100, 1, 1),
        youngest=datetime(2000, 1, 1))
    for entity in entities:
        key_name = entity.key().name()
        data = serialize(entity)
        logging.info('serialized %s %s to %s', kind, key_name, data)
        info = zipfile.ZipInfo(
            filename=key_name.rstrip('/').encode('utf-8'),
            date_time=entity.modified.timetuple()[:6])
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, data)
        backup.keys.append(key_name)
        backup.oldest = min(backup.oldest, entity.modified)
        backup.youngest = max(backup.youngest, entity.modified)
    archive.close()
    backup.zipfile = temp.getvalue()
    temp.close()
    backup.put()
    return render_to_response(request, 'backups/cron.html',
                              {'backup': backup})
