from django.http import HttpResponse, Http404
from django.utils import simplejson as json

from utils.json import model_to_json
from utils.decorators import jsonp, method_required

from apps.models import App
from documents.models import Document
from storage.models import KeyValue


@jsonp
@method_required('GET')
def document(request, doc_id):
    """
    Get document metadata.
    """
    request.key_name = '/'.join((request.app.app_id(), doc_id.lower()))
    if request.doc is None:
        raise Http404("Could not find document " + request.key_name)
    extra = None
    data = KeyValue.get_by_key_name(request.key_name)
    if data:
        extra = {"json": json.loads(data.value)}
    result = model_to_json(request.doc, extra)
    return HttpResponse(result, mimetype='application/json')
