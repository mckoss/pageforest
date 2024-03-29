import urllib
import logging

from hashlib import sha1

from django.conf import settings
from django.http import \
    HttpResponse, HttpResponseNotModified, HttpResponseNotAllowed
from django.utils import simplejson as json

from google.appengine.ext import db

from utils.json import ModelEncoder
from utils.decorators import jsonp, method_required, no_cache
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

    TODO: This should be a paged result.  Actualy should convert this
    page to a cross-application app (like editor) with features like
    view by app and tag, icon view, and list views.
    """
    title = "My documents"
    query = Doc.all()
    query.filter('owner', request.user.get_username())
    query.order('-modified')
    return render_to_response(request, 'docs/index.html', {
            'title': title,
            'docs_list': query.fetch(MAX_LIST)})


@login_required
@method_required('LIST')
def app_docs(request):
    """
    List the current user's OWNED documents within the current app.

    TODO: Add flexible filters as query string arguments.
    ?prefix=abc
    ?tag=demo
    ?readers=public
    ?writers=username

    See blob_list for similar code...

    REVIEW: Is this safe to add @jsonp - would need to only
    return to approved domains or public documents?

    REVIEW: And why is this just the current user's docs?  No way to enumerate
    all the docs in the application?  What about for the application owner?

    TODO: Allow all the Blob LIST parameters.
    """
    try:
        keys_only = get_bool(request.GET, 'keysonly', default=False)
        limit = get_int(request.GET, 'limit', default=MAX_LIST)
        limit = min(limit, MAX_LIST)
    except ValueError, error:
        return HttpJSONResponse({'statusText': error.message}, status=400)

    query = request.app.all_docs(owner=request.user.get_username(), keys_only=keys_only)
    if 'cursor' in request.GET:
        query.with_cursor(request.GET['cursor'])

    def filter_by_tag(doc):
        """ All tags must match to return false.

        Until all_docs is fixed - can't combine filters in query - do post-query
        filtering instead.
        """
        for tag in request.GET.getlist('tag'):
            if urllib.unquote_plus(tag) not in doc.tags:
                return True
        return False

    docs = query.fetch(limit)
    items = {}
    for doc in docs:
        if keys_only:
            # WARNING: Document tombstones WILL show up in the
            # keys_only form of the list command.
            doc_id = doc.name().split('/')[1]
            items[doc_id] = {}
            continue

        if doc.deleted or filter_by_tag(doc):
            continue

        info = {'modified': doc.modified,
                'sha1': doc.sha1,
                'size': doc.size,
                }
        if doc.tags:
            info['tags'] = doc.tags
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


@no_cache
def doc_get(request, doc_id):
    """
    Return JSON formatted representation of a Doc.
    """
    etag = request.doc.get_etag()
    if etag == request.META.get('HTTP_IF_NONE_MATCH', ''):
        response = HttpResponseNotModified(mimetype=settings.JSON_MIMETYPE_CS)
    else:
        response = HttpResponse(request.doc.to_json(), mimetype=settings.JSON_MIMETYPE_CS)
    request.doc.update_headers(response)
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

    # Write JSON blob to blob storage.
    key_name = request.doc.blob_key_prefix() + '/'
    if 'blob' in parsed:
        # Smallest format - and canonical ordering
        value = json.dumps(parsed['blob'],
                           separators=(',', ':'),
                           sort_keys=True)
        blob = Blob(key_name=key_name, value=value)
        blob.put()

    # Write document after blob updated - for sha1 calculation
    request.doc.put()

    dispatch_subscriptions(key_name, 'PUT',
                           {'sha1': request.doc.sha1,
                            'size': request.doc.size,
                            'modified': request.doc.modified})

    response = HttpJSONResponse({
        'statusText': status == 200 and "Saved" or "Created",
        'docid': request.doc.doc_id,
        'modified': request.doc.modified,
        'owner': request.doc.owner,
        'sha1': request.doc.sha1,
        }, status=status)

    request.doc.update_headers(response)
    return response


def doc_delete(request, docid):
    """
    HTTP DELETE request handler.

    TODO: Have an if-modified and return 409 Conflict if
    the passed in hash or modified date is incorrect.
    """
    request.doc.delete()
    request.doc = None
    return HttpJSONResponse({'statusText': "Deleted"})


@no_cache
def doc_list(request, doc_id):
    """
    List blobs inside the root document, using the blob list interface.
    """
    request.key_name = request.doc.blob_key_prefix() + '/'
    return blob_list(request)
