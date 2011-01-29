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
from utils.json import ModelEncoder, HttpJSONResponse

from auth import AuthError
from auth.middleware import AccessDenied
from auth.decorators import login_required

from apps.models import App
from apps.forms import AppForm


@method_required('GET', 'LIST')
def index(request):
    """
    Show a list of apps, with filtering and sorting.

    TODO: Replace with apps.pageforest.com - cross app
    app - directory and marketplace.
    """
    if request.method == 'LIST':
        return app_list(request)

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


@login_required
@method_required('LIST')
def app_list(request):
    """
    List the current user's owned and writable apps.
    """
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
            'created': app.created,
            'owner': app.owner,
            'title': app.title,
            'url': app.url,
            'tags': app.tags,
            'readers': app.readers,
            'writers': app.writers,
            }
        if app.icon:
            info['icon'] = app.icon
        items[app.get_app_id()] = info
    return HttpJSONResponse({'items': items}, status=None)


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
            new_app.put()
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
@method_required('GET', 'PUT', 'DELETE')
def app_json(request):
    """
    Read and write application info with REST API.

    Note that the LIST command for the app blobs is
    """
    if request.method == 'GET':
        return app_json_get(request)
    elif request.method == 'PUT':
        return app_json_put(request)
    elif request.method == 'DELETE':
        return app_json_delete(request)


def app_json_get(request):
    """
    Get JSON blob with meta info for this app.
    """
    if not request.app.is_readable(request.user):
        return AccessDenied(request)
    content = request.app.to_json(extra={"application": request.app.get_app_id()})
    return HttpResponse(content, mimetype=settings.JSON_MIMETYPE_CS)


# REVIEW: Why not login required?
#@login_required
def app_json_put(request):
    """
    Parse incoming JSON blob and update meta info for this app.
    """
    status = 200
    if not request.app.owner:
        try:
            request.user.assert_authorized(App.create)
        except Exception, error:
            return HttpJSONResponse({'textStatus': unicode(error)}, status=403)
        status = 201
        request.app.owner = request.user.get_username()

    if not request.app.is_writable(request.user):
        return AccessDenied(request, "No write permission.")

    # Update app from uploaded JSON data.
    parsed = json.loads(request.raw_post_data)
    # TODO: Should confirm that user is retaining write permission as either
    # owner or writer!
    request.app.update_from_json(parsed)
    request.app.put()

    response = HttpJSONResponse({
        'statusText': status == 200 and "Saved" or "Created",
        'modified': request.app.modified,
        'sha1': request.app.sha1,
        }, status=status)

    request.app.update_headers(response)

    return response


def app_json_delete(request):
    """
    Delete the application.

    Note that none of the user created documents are delete - they will be orphaned.

    Any new app with the same name will inherit the older documents.

    REVIEW: Why are permissions handled directly here and NOT for same verbs
    for docs (in auth/middleware)?
    """
    if not request.app.is_writable(request.user):
        return AccessDenied(request, "No write permission.")

    request.app.delete()
    request.app = None
    return HttpJSONResponse({'statusText': "Deleted"})
