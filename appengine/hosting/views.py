from django.conf import settings
from django.http import Http404, HttpResponse

from hosting.models import Document


def document(request, filename='index.html', mimetype='text/html'):
    request.app_name = request.META.get('HTTP_HOST', 'test').lower()
    if request.app_name.endswith(settings.HOST_REMOVABLE):
        request.app_name = request.app_name[:-len(settings.HOST_REMOVABLE)]
    request.key_name = request.app_name + '/' + filename
    if request.method == 'GET':
        return document_get(request, filename, mimetype)
    elif request.method == 'PUT':
        return document_put(request, filename, mimetype)
    elif request.method == 'DELETE':
        return key_value_delete(request)
    elif request.method == 'HEAD':
        response = key_value_get(request)
        response.content = ''
        return response
    else:
        return HttpResponseNotAllowed('GET PUT DELETE HEAD'.split())


def document_get(request, filename, mimetype):
    document = Document.get_by_key_name(request.key_name)
    if document is None:
        raise Http404
    return HttpResponse(document.content, mimetype=mimetype)


def document_put(request, filename, mimetype):
    document = Document(
        key_name=request.key_name,
        content=request.raw_post_data)
    document.put()
    return HttpResponse('saved', mimetype='text/plain')


def document_delete(request, filename, mimetype):
    document = Document.get_by_key_name(request.key_name)
    if document is None:
        raise Http404
    document.delete()
    return HttpResponse('deleted', mimetype='text/plain')
