from django.http import HttpResponse, Http404
from django.utils import simplejson as json

from utils.json import model_to_json

from apps.models import App
from documents.models import Document
from storage.models import KeyValue


def document(request, doc_id):
    """
    Get document metadata.
    """
    hostname = request.META.get('HTTP_HOST', 'test')
    request.app = App.get_by_hostname(hostname)
    if request.app is None:
        raise Http404
    app_id = request.app.key().name()
    request.key_name = '/'.join((app_id, doc_id)).lower()
    doc = Document.get_by_key_name(request.key_name)
    if doc is None:
        raise Http404
    extra = None
    data = KeyValue.get_by_key_name(request.key_name)
    if data:
        extra = {"json": json.loads(data.value)}
    result = model_to_json(doc, extra, exclude='readers writers'.split())
    return HttpResponse(result, mimetype='application/javascript')
