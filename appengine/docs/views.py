import logging

from django.conf import settings
from django.http import \
    HttpResponse, HttpResponseNotModified, HttpResponseNotAllowed
from django.utils import simplejson as json

from google.appengine.ext import db

from utils.json import ModelEncoder
from utils.decorators import jsonp, method_required
from utils.shortcuts import render_to_response
from utils.http import http_datetime
from utils.channel import dispatch_subscriptions
from auth.decorators import login_required
from auth.middleware import AccessDenied

from docs.models import Doc
from blobs.models import Blob
from blobs.views import blob_list

from utils.json import ModelEncoder


@login_required
@method_required('GET')
def index(request):
    """
    Show a list of documents for this user.
    """
    title = "My documents"
    query = Doc.all()
    query.filter('owner', request.user.get_username())
    query.order('-modified')
    return render_to_response(request, 'docs/index.html', {
            'title': title,
            'docs_list': query.fetch(100)})


@login_required
@method_required('LIST')
def app_docs(request):
    """
    List the current user's documents within the current app.

    TODO: Add flexible filters as query string arguments.
    ?prefix=abc
    ?tag=demo
    ?owner=username
    ?readers=public
    ?writers=username
    """
    query = Doc.all()
    query.filter('owner', request.user.get_username())
    key_name = request.app.get_app_id()
    query.filter('__key__ >=', db.Key.from_path('Doc', key_name + '/'))
    query.filter('__key__ <', db.Key.from_path('Doc', key_name + '0'))
    docs = query.fetch(100)
    blob_keys = [db.Key.from_path('Blob', doc.key().name() + '/')
                 for doc in docs]
    blobs = db.get(blob_keys)
    result = {}
    for doc, blob in zip(docs, blobs):
        info = {'json': True}
        if blob:
            info['modified'] = max(doc.modified, blob.modified)
            info['sha1'] = blob.sha1
            info['size'] = len(blob.value)
        else:
            info['modified'] = doc.modified
        result[doc.doc_id] = info
    serialized = json.dumps(result, sort_keys=True, indent=2,
                            separators=(',', ': '), cls=ModelEncoder)
    return HttpResponse(serialized, mimetype=settings.JSON_MIMETYPE)


@jsonp
def dispatch(request, doc_id):
    """
    Read or write document metadata.
    """
    function_name = 'doc_' + request.method.lower()
    if function_name not in globals():
        allow = [name[4:].upper() for name in globals()
                 if name.startswith('doc_')]
        allow.sort()
        logging.info("ReponseNotAllowed(%r)" % allow)
        return HttpResponseNotAllowed(allow)
    view_function = globals()[function_name]
    response = view_function(request, doc_id)
    return response


def doc_get(request, doc_id):
    """
    Get JSON blob with meta info for this document.
    """
    extra = None
    modified = request.doc.modified
    # Get extra data from blob store.
    blob = Blob.get_by_key_name(request.doc.key().name() + '/')
    if blob:
        extra = {"blob": json.loads(blob.value)}
        modified = max(modified, blob.modified)
    # Generate Last-Modified header and compare with If-Modified-Since.
    last_modified = http_datetime(modified)
    if last_modified == request.META.get('HTTP_IF_MODIFIED_SINCE', ''):
        return HttpResponseNotModified()
    # Generate pretty JSON output.
    result = request.doc.to_json(exclude=settings.HIDDEN_PROPERTIES,
                                 extra=extra)
    response = HttpResponse(result, mimetype=settings.JSON_MIMETYPE)
    response['Last-Modified'] = last_modified
    return response


def doc_put(request, doc_id):
    """
    Parse incoming JSON blob and update meta info for this document.
    """
    if request.doc is None:
        # Create this document. TODO: Quota check.
        request.doc = Doc.create(request.app.get_app_id(), doc_id,
                                 request.user)
    try:
        parsed = json.loads(request.raw_post_data)
        request.doc.update_from_json(parsed, user=request.user)
    except ValueError, error:
        # TODO: Format error as JSON.
        return HttpResponse(unicode(error), mimetype='text/plain', status=400)
    request.doc.normalize_lists()
    request.doc.put()
    # Write JSON blob to blob storage.
    if 'blob' in parsed:
        key_name = request.doc.key().name() + '/'
        value = json.dumps(parsed['blob'], sort_keys=True)
        blob = Blob(key_name=key_name, value=value)
        blob.put()
        dispatch_subscriptions(key_name, 'PUT',
                               {'sha1': blob.sha1,
                                'size': blob.size,
                                'modified': blob.modified})

    json_result = json.dumps({
            'status': 200,
            'statusText': "Saved",
            'modified': request.doc.modified,
            }, cls=ModelEncoder)

    return HttpResponse(json_result, mimetype=settings.JSON_MIMETYPE)


def doc_list(request, doc_id):
    """
    List blobs inside a document, using the blob list interface.
    """
    request.key_name = request.doc.key().name() + '/'
    return blob_list(request)
