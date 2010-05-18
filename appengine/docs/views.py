from django.conf import settings
from django.http import HttpResponse, HttpResponseNotModified
from django.utils import simplejson as json

from utils.json import model_to_json, assert_string, assert_string_list
from utils.decorators import jsonp, method_required
from utils.shortcuts import render_to_response
from utils.http import http_datetime
from auth.decorators import login_required

from docs.models import Doc
from blobs.models import Blob


@login_required
@method_required('GET')
def index(request):
    """
    Show a list of documents for this user.
    """
    title = "My documents"
    query = Doc.all()
    query.filter('writers', request.user.username.lower())
    query.order('-modified')
    return render_to_response(request, 'docs/index.html', {
            'title': title,
            'docs_list': query.fetch(20)})


@jsonp
@method_required('GET', 'PUT')
def document(request, doc_id):
    """
    Read or write document metadata.
    """
    if request.method == 'GET':
        return document_get(request, doc_id)
    elif request.method == 'PUT':
        return document_put(request, doc_id)


def document_get(request, doc_id):
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
    result = model_to_json(request.doc, extra)
    response = HttpResponse(result, mimetype=settings.JSON_MIMETYPE)
    response['Last-Modified'] = last_modified
    return response


def document_put(request, doc_id):
    """
    Parse incoming JSON blob and update meta info for this document.
    """
    if request.doc is None:
        # Create this document. TODO: Quota check.
        request.doc = Doc.create(request.app.get_app_id(), doc_id,
                                 request.user)
    try:
        parsed = json.loads(request.raw_post_data)
        for key in ('title', 'doc_id'):
            if key in parsed:
                assert_string(key, parsed[key])
                setattr(request.doc, key, parsed[key])
        for key in ('tags', 'readers', 'writers'):
            if key in parsed:
                assert_string_list(key, parsed[key])
                setattr(request.doc, key, parsed[key])
    except ValueError, error:
        # TODO: Format error as JSON.
        return HttpResponse(unicode(error), mimetype='text/plain', status=400)
    request.doc.normalize_lists()
    request.doc.put()
    # Write JSON blob to blob storage.
    if 'blob' in parsed:
        key_name = request.doc.key().name() + '/'
        value = json.dumps(parsed['blob'], sort_keys=True)
        Blob(key_name=key_name, value=value).put()
    return HttpResponse('{"status": 200, "statusText": "Saved"}',
                        mimetype=settings.JSON_MIMETYPE)
