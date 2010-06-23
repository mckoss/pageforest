import logging

from django.conf import settings
from django.http import HttpResponse
from django.utils import simplejson as json

from utils.json import ModelEncoder
from utils.decorators import jsonp, method_required
from auth.decorators import login_required

from apps.models import App
from blobs.models import Blob


def find_app_icons(filename, result):
    """
    Find icons for the specified apps, and add them to the dictionary.
    """
    app_ids = result.keys()
    key_names = ['apps/' + app_id + '/' + filename + '/'
                 for app_id in app_ids
                 if 'icon' not in result[app_id]]
    blobs = Blob.get_by_key_name(key_names)
    for app_id, blob in zip(app_ids, blobs):
        if blob is not None:
            result[app_id]['icon'] = filename


@login_required
@method_required('LIST')
def mirror_list(request):
    """
    Show a LIST of apps that are available for mirroring.
    """
    logging.info(request.user.get_username())
    # Get apps owned by the current user.
    query = App.all(keys_only=True)
    query.filter('owner', request.user.get_username())
    owner_apps = [key.name() for key in query]
    # Get apps with write permission for the current user.
    query = App.all(keys_only=True)
    query.filter('writers', request.user.get_username())
    writer_apps = [key.name() for key in query]
    # Combine and load apps from the datastore.
    app_names = set(owner_apps + writer_apps)
    apps = App.get_by_key_name(app_names)
    result = {}
    for app in apps:
        result[app.get_app_id()] = {
            'cloneable': app.cloneable,
            'modified': app.modified,
            'owner': app.owner,
            'title': app.title,
            'url': app.url,
            }
        if app.tags:
            result[app.get_app_id()]['tags'] = app.tags
    find_app_icons('favicon.png', result)
    find_app_icons('apple-touch-icon.png', result)
    find_app_icons('apple-touch-icon-precomposed.png', result)
    find_app_icons('favicon.ico', result)
    # Generate pretty JSON output.
    serialized = json.dumps(result, sort_keys=True, indent=2,
                            separators=(',', ': '), cls=ModelEncoder)
    return HttpResponse(serialized, mimetype=settings.JSON_MIMETYPE)
