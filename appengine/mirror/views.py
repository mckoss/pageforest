import logging

from utils.json import ModelEncoder, HttpJSONResponse
from utils.decorators import jsonp, method_required
from auth.decorators import login_required

from apps.models import App
from blobs.models import Blob


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
    items = {}
    for app in apps:
        info = {
            'cloneable': app.cloneable,
            'modified': app.modified,
            'owner': app.owner,
            'title': app.title,
            'url': app.url,
            'tags': app.tags,
            }
        if app.icon:
            info['icon'] = app.icon
        items[app.get_app_id()] = info
    return HttpJSONResponse({'items': items}, status=None)
