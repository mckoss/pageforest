import time
import logging

from django.conf import settings
from django.http import HttpResponse, HttpResponseBadRequest
from django.utils import simplejson as json
from django.shortcuts import redirect

from google.appengine.api import memcache

from utils.shortcuts import render_to_response, lookup_or_404
from utils.decorators import jsonp, method_required
from utils import crypto
from utils.json import ModelEncoder

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
def app_json(request):
    """
    Read and write application info with REST API.
    """
    if request.method == 'GET':
        return app_json_get(request)
    if request.method == 'PUT':
        return app_json_put(request)


def app_json_get(request):
    """
    Get JSON blob with meta info for this app.
    """
    if not request.app.is_readable(request.user):
        return AccessDenied(request)
    # Timestamps are excluded to avoid uploading app.json again and
    # again because the SHA-1 hash keeps changing.
    content = request.app.to_json(
        exclude=settings.HIDDEN_PROPERTIES + ('created', 'modified'),
        extra={"application": request.app.get_app_id()})
    return HttpResponse(content, mimetype=settings.JSON_MIMETYPE_CS)


@login_required
def app_json_put(request):
    """
    Parse incoming JSON blob and update meta info for this app.
    """
    if request.app.owner is None:
        request.app.owner = request.user.get_username()
    if not request.app.is_writable(request.user):
        return AccessDenied(request, "No write permission.")
    # Update app from uploaded JSON data.
    try:
        parsed = json.loads(request.raw_post_data)
        request.app.update_from_json(parsed)
    except ValueError, error:
        # TODO: Format error as JSON.
        return HttpResponse(unicode(error), mimetype='text/plain', status=400)
    request.app.put()
    return HttpResponse('{"status": 200, "statusText": "Saved"}',
                        mimetype=settings.JSON_MIMETYPE_CS)
