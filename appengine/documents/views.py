from django.http import HttpResponse, HttpResponseForbidden, Http404
from django.utils import simplejson as json

from utils.json import model_to_json
from utils.decorators import jsonp, method_required
from auth.middleware import AccessDenied

from storage.models import KeyValue


@jsonp
@method_required('GET')
def document(request, doc_id):
    """
    Get document metadata.
    """
    if not request.doc.is_readable(request.user):
        return AccessDenied(request)
    data = KeyValue.get_by_key_name(request.doc.key().name())
    if data:
        extra = {"json": json.loads(data.value)}
    else:
        extra = None
    result = model_to_json(request.doc, extra)
    return HttpResponse(result, mimetype='application/json')
