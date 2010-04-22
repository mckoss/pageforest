from django.http import HttpResponse
from django.utils import simplejson as json

from utils.json import model_to_json
from utils.decorators import jsonp, method_required


def assert_string(key, value):
    if not isinstance(value, basestring):
        raise ValueError("Expected string value for %s." % key)


def assert_string_list(key, value):
    if not isinstance(value, list):
        raise ValueError("Expected string list for %s." % key)
    for item in value:
        if not isinstance(item, basestring):
            raise ValueError("Expected string values inside %s list." % key)


@method_required('GET', 'PUT')
def app_info(request):
    """Read and write application info with REST API."""
    try:
        if request.method == 'PUT':
            parsed = json.loads(request.raw_post_data)
            for key in ('title', ):
                if key in parsed:
                    assert_string(key, parsed[key])
                    setattr(request.app, key, parsed[key])
            for key in ('domains', 'readers', 'writers'):
                if key in parsed:
                    assert_string_list(key, parsed[key])
                    setattr(request.app, key, parsed[key])
        request.app.put()
        return HttpResponse('{"status": 200, "statusText": "Saved"}',
                            mimetype='application/json')
    except ValueError, e:
        return HttpResponse(unicode(e), mimetype='text/plain', status=400)
    return HttpResponse(model_to_json(request.app, exclude='secret'.split()),
                        mimetype='application/json')
