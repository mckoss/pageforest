from django.conf import settings
from django.http import HttpResponse
from django.utils import simplejson as json

from utils.json import model_to_json, assert_string, assert_string_list
from utils.decorators import jsonp, method_required
from auth.middleware import AccessDenied

from apps.models import App


@jsonp
@method_required('GET', 'PUT')
def app_json(request, app_id):
    """
    Read and write application info with REST API.
    """
    if request.method == 'GET':
        return app_json_get(request, app_id)
    if request.method == 'PUT':
        return app_json_put(request, app_id)


def app_json_get(request, app_id):
    """
    Get JSON blob with meta info for this app.
    """
    request.app = App.lookup(app_id)
    if not request.app.is_readable(request.user):
        return AccessDenied(request)
    content = model_to_json(request.app, exclude='secret'.split())
    return HttpResponse(content, mimetype=settings.JSON_MIMETYPE)


def app_json_put(request, app_id):
    """
    Parse incoming JSON blob and update meta info for this app.
    """
    request.app = App.lookup(app_id)
    if request.app is None:
        # Check session key.
        if request.user is None:
            return AccessDenied(request)
        # Create a new App with this app_id.
        request.app = App.create(app_id, request.user)
    if not request.app.is_writable(request.user):
        return AccessDenied(request)
    # TODO: Quota check.
    try:
        parsed = json.loads(request.raw_post_data)
        for key in ('title', ):
            if key in parsed:
                assert_string(key, parsed[key])
                setattr(request.app, key, parsed[key])
        for key in ('tags', 'readers', 'writers', 'domains'):
            if key in parsed:
                assert_string_list(key, parsed[key])
                setattr(request.app, key, parsed[key])
    except ValueError, error:
        # TODO: Format error as JSON.
        return HttpResponse(unicode(error), mimetype='text/plain', status=400)
    request.app.put()
    return HttpResponse('{"status": 200, "statusText": "Saved"}',
                        mimetype=settings.JSON_MIMETYPE)
