from django.conf import settings
from django.http import HttpResponse
from django.utils import simplejson as json
from django.shortcuts import redirect

from utils.shortcuts import render_to_response, lookup_or_404
from utils.json import model_to_json
from utils.decorators import jsonp, method_required

from auth import AuthError
from auth.middleware import AccessDenied
from auth.decorators import login_required

from apps.models import App
from apps.forms import AppForm


@method_required('GET')
def index(request):
    """
    Show a list of apps, with filtering and sorting.
    """
    title = "Featured apps"
    query = App.all()
    if 'writer' in request.GET:
        title = "Apps from " + request.GET['writer']
        query.filter('writers', request.GET['writer'])
    else:
        query.filter('readers', 'public')
    if 'tag' in request.GET:
        title = "Apps tagged " + request.GET['tag']
        query.filter('tags', request.GET['tag'])
    apps = [app for app in query.fetch(20) if not app.is_www()]
    return render_to_response(request, 'apps/index.html', {
            'title': title, 'apps': apps})


@method_required('GET')
def details(request, app_id):
    """
    Show details for a specific app.
    """
    app = lookup_or_404(App, app_id)
    static_blobs = ['/'.join(blob.key().name().split('/')[2:-1])
                    for blob in app.fetch_static_blobs()]
    return render_to_response(request, 'apps/details.html', {
            'app': app, 'static_blobs': static_blobs})


@login_required
@method_required('GET', 'POST')
def clone(request, app_id):
    app = lookup_or_404(App, app_id)
    if request.method == 'POST':
        form = AppForm(request.POST)
        if form.is_valid():
            form.cleaned_data['owner'] = request.user.get_username()
            new_app = form.save()
            new_app_id = new_app.get_app_id()
            for blob in app.fetch_static_blobs():
                parts = blob.key().name().split('/')
                parts[1] = new_app_id
                new_blob = blob.clone('/'.join(parts))
                new_blob.put()
            # TODO: Save everything with only one datastore
            # round-trip. We can't simply use db.put(entity_list)
            # because that ignores the overriden model.put() methods
            # in the Cacheable and Timestamped mixins.
            return redirect(new_app.get_absolute_url())
    else:
        form = AppForm(initial=app.get_form_dict())
    return render_to_response(request, 'apps/clone.html', {
            'app': app, 'form': form})


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
    app = lookup_or_404(App, app_id)
    if not app.is_readable(request.user):
        return AccessDenied(request)
    content = model_to_json(app)
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
        # Check app creator permission.
        try:
            request.user.assert_authorized(App.create)
        except AuthError, error:
            return AccessDenied(request, error.message)
        # Create a new App with this app_id.
        app = App.create(app_id, request.user)
    if not app.is_writable(request.user):
        return AccessDenied(request)
    # TODO: Quota check.
    try:
        parsed = json.loads(request.raw_post_data)
        app.update_from_json(parsed, user=request.user)
    except ValueError, error:
        # TODO: Format error as JSON.
        return HttpResponse(unicode(error), mimetype='text/plain', status=400)
    app.normalize_lists()
    app.put()
    return HttpResponse('{"status": 200, "statusText": "Saved"}',
                        mimetype=settings.JSON_MIMETYPE)
