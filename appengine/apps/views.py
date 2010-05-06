from django.conf import settings
from django.http import HttpResponse, HttpResponseRedirect
from django.utils import simplejson as json

from utils.json import model_to_json, assert_string, assert_string_list
from utils.decorators import jsonp, method_required
from auth.middleware import AccessDenied

from apps.models import App


@method_required('GET', 'POST')
def create_app(request, app_id):
    """
    Bootstrap application creation.

    Since we can't access app_id.pf.com before an application is
    created, we go to www.pf.com/apps/app_id to create the intial
    instance of the application.

    We accept content in the format of app.json here for initial
    application creation.  If none is given, we default to:


    """
    # TODO: Permissions and quota check
    app = App.create(app_id, request.user)
    app.put()
    # TODO: should return a default app.json???
    return HttpResponse('%s created.' % app_id)


@jsonp
@method_required('GET', 'PUT')
def app_json(request, app_id):
    """
    Read and write application info with REST API.
    """
    request.app = App.lookup(app_id)
    if request.method == 'GET':
        return app_json_get(request, app_id)
    if request.method == 'PUT':
        return app_json_put(request, app_id)


def app_json_get(request, app_id):
    """
    Get JSON blob with meta info for this app.
    """
    if not request.app.is_readable(request.user):
        return AccessDenied(request)
    content = model_to_json(request.app, exclude='secret'.split())
    return HttpResponse(content, mimetype=settings.JSON_MIMETYPE)


def app_json_put(request, app_id):
    """
    Parse incoming JSON blob and update meta info for this app.
    """
    if request.app and not request.app.is_writable(request.user):
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
