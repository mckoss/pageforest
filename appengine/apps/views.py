from django.conf import settings
from django.http import HttpResponse, Http404
from django.utils import simplejson as json
from django.shortcuts import redirect

from utils.shortcuts import render_to_response
from utils.json import model_to_json, assert_string, assert_string_list
from utils.decorators import jsonp, method_required
from auth.middleware import AccessDenied
from auth.decorators import login_required

from apps.models import App


@method_required('GET')
def index(request):
    """
    Show a list of apps, with filtering and sorting.
    """
    title = "Featured apps"
    query = App.all()
    query.filter('readers', 'public')
    if 'writer' in request.GET:
        title = "Apps from " + request.GET['writer']
        query.filter('writers', request.GET['writer'])
    if 'tag' in request.GET:
        title = "Apps tagged " + request.GET['tag']
        query.filter('tags', request.GET['tag'])
    return render_to_response(request, 'apps/index.html', {
            'title': title,
            'apps_list': query.fetch(20)})


@method_required('GET')
def details(request, app_id):
    """
    Show details for a specific app.
    """
    app = App.get_by_key_name(app_id)
    if app is None:
        raise Http404("App not found: " + app_id)
    return render_to_response(request, 'apps/details.html',
                              {'app': app})


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
    app = App.lookup(app_id)
    if app is None:
        raise Http404("App not found: " + app_id)
    if not app.is_readable(request.user):
        return AccessDenied(request)
    content = model_to_json(app, exclude='secret'.split())
    return HttpResponse(content, mimetype=settings.JSON_MIMETYPE)


def app_json_put(request, app_id):
    """
    Parse incoming JSON blob and update meta info for this app.
    """
    app = App.lookup(app_id)
    if app is None:
        # Check session key.
        if request.user is None:
            return AccessDenied(request)
        # Create a new App with this app_id.
        app = App.create(app_id, request.user)
    if not app.is_writable(request.user):
        return AccessDenied(request)
    # TODO: Quota check.
    try:
        parsed = json.loads(request.raw_post_data)
        for key in ('title', ):
            if key in parsed:
                assert_string(key, parsed[key])
                setattr(app, key, parsed[key])
        for key in ('tags', 'readers', 'writers', 'domains'):
            if key in parsed:
                values = parsed[key]
                assert_string_list(key, values)
                # Special treatment if App.update_key method exists.
                update_method = getattr(app, 'update_' + key, None)
                if update_method:
                    update_method(values, request.user)
                else:
                    setattr(app, key, values)
    except ValueError, error:
        # TODO: Format error as JSON.
        return HttpResponse(unicode(error), mimetype='text/plain', status=400)
    app.put()
    return HttpResponse('{"status": 200, "statusText": "Saved"}',
                        mimetype=settings.JSON_MIMETYPE)
