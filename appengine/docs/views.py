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

from utils.json import ModelEncoder, HttpJSONResponse
from utils.shortcuts import get_int, get_bool

MAX_LIST = 1000


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

    See blob_list for similar code...

    REVIEW: Is this safe to add @jsonp - would need to only
    return to approved domains or public documents?

    And why is this just the current user's docs?  No way to enumerate
    all the docs in the application?  What about for the application owner?
    """
    try:
        keys_only = get_bool(request.GET, 'keysonly', default=False)
        limit = get_int(request.GET, 'limit', default=MAX_LIST)
        limit = min(limit, MAX_LIST)
    except ValueError, error:
        return HttpJSONResponse({'statusText': error.message}, status=400)

    query = Doc.all(keys_only=keys_only)

    query.filter('owner', request.user.get_username())
    key_name = request.app.get_app_id()
    query.filter('__key__ >=', db.Key.from_path('Doc', key_name + '/'))
    query.filter('__key__ <', db.Key.from_path('Doc', key_name + '0'))

    if 'cursor' in request.GET:
        query.with_cursor(request.GET['cursor'])

    docs = query.fetch(limit)
    blob_keys = [db.Key.from_path('Blob', doc.key().name() + '/')
                 for doc in docs]
    # TODO: Cache sha1 and size in doc, so we don't have to fetch
    # the blobs!
    blobs = db.get(blob_keys)
    items = {}
    for doc, blob in zip(docs, blobs):
        info = {'json': True,
                'modified': doc.modified,
                }
        if blob:
            info['sha1'] = blob.sha1
            info['size'] = len(blob.value)
        items[doc.doc_id] = info
    result = {'items': items}
    if (len(docs) == limit):
        result['cursor'] = query.cursor()
    return HttpJSONResponse(result, status=None)


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
    # Should update to SHA1 hash of document to avoid failures from writes
    # in the same second.
    last_modified = http_datetime(modified)
    if last_modified == request.META.get('HTTP_IF_MODIFIED_SINCE', ''):
        return HttpResponseNotModified(mimetype=settings.JSON_MIMETYPE_CS)
    # Generate pretty JSON output.
    result = request.doc.to_json(exclude=settings.HIDDEN_PROPERTIES,
                                 extra=extra)
    response = HttpResponse(result, mimetype=settings.JSON_MIMETYPE_CS)
    response['Last-Modified'] = last_modified
    return response


def doc_put(request, doc_id):
    """
    Parse incoming JSON blob and update meta info for this document.

    TODO: Have an if-modified and return 409 Conflict if
    the passed in hash or modified date is incorrect.
    """
    status = 200
    if request.doc is None:
        # Create this document. TODO: Quota check.
        status = 201
        request.doc = Doc.create(request.app.get_app_id(), doc_id,
                                 request.user)
    try:
        parsed = json.loads(request.raw_post_data)
        request.doc.update_from_json(parsed, user=request.user)
    except ValueError, error:
        return HttpJSONResponse({'statusText': unicode(error)}, status=400)

    # Should call update_tags as in blob_put

    request.doc.put()
    # Write JSON blob to blob storage.
    if 'blob' in parsed:
        key_name = request.doc.key().name() + '/'
        # Smallest format - and canonical ordering
        value = json.dumps(parsed['blob'],
                           separators=(',', ':'),
                           sort_keys=True)
        blob = Blob(key_name=key_name, value=value)
        blob.put()
        dispatch_subscriptions(key_name, 'PUT',
                               {'sha1': blob.sha1,
                                'size': blob.size,
                                'modified': request.doc.modified})

    # TODO: Note that modifying only doc meta-data does not trigger
    # a channel subscription update.  Should it?

    return HttpJSONResponse({
        'statusText': status == 200 and "Saved" or "Created",
        'modified': request.doc.modified,
        }, status=status)


def doc_delete(request, docid):
    """
    HTTP DELETE request handler.

    TODO: Have an if-modified and return 409 Conflict if
    the passed in hash or modified date is incorrect.
    """
    request.doc.delete()
    request.doc = None
    return HttpJSONResponse({'statusText': "Deleted"})


def doc_list(request, doc_id):
    """
    List blobs inside the root document, using the blob list interface.
    """
    request.key_name = request.doc.key().name() + '/'
    return blob_list(request)
