from django.http import HttpResponse, Http404

from apps.models import App
from documents.models import Document


def document(request, doc_id):
    request.app = App.get_by_hostname(request.META.get('HTTP_HOST', 'test'))
    request.key_name = '/'.join((request.app.key().name(), doc_id))
    document = Document.get_by_key_name(request.key_name)
    if document is None:
        raise Http404
    return HttpResponse(unicode(document), mimetype='application/javascript')
