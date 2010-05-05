from django.http import HttpResponse, HttpResponseForbidden, Http404
from django.utils import simplejson as json

from utils.json import model_to_json
from utils.decorators import jsonp, method_required

from storage.models import KeyValue


@jsonp
@method_required('GET')
def document(request, doc_id):
    """
    Get document metadata.
    """
    if request.doc is None:
        raise Http404("Could not find document " + request.key_name)
    if not request.doc.is_readable(request.user):
        if hasattr(request, 'session_key_error'):
            return HttpResponseForbidden(request.session_key_error)
        else:
            return HttpResponseForbidden("Access denied.")
    data = KeyValue.get_by_key_name(request.doc.key().name())
    if data:
        extra = {"json": json.loads(data.value)}
    else:
        extra = None
    result = model_to_json(request.doc, extra)
    return HttpResponse(result, mimetype='application/json')
