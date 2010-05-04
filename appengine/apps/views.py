from django.http import HttpResponse
from django.utils import simplejson as json

from utils.json import model_to_json
from utils.decorators import jsonp, method_required


@jsonp
@method_required('GET', 'PUT')
def app_json(request):
    """
    Read and write application info with REST API.
    """
    if request.method == 'GET':
        content = model_to_json(request.app, exclude='secret'.split())
        return HttpResponse(content, mimetype='application/json')
    if request.method == 'PUT':
        return app_json_put(request)


def app_json_put(request):
    """
    Parse incoming JSON blob and update meta info for this app.
    """
    try:
        parsed = json.loads(request.raw_post_data)
        for key in ('title', ):
            if key in parsed:
                assert_string(key, parsed[key])
                setattr(request.app, key, parsed[key])
        for key in ('domains', 'readers', 'writers'):
            if key in parsed:
                assert_string_list(key, parsed[key])
                setattr(request.app, key, parsed[key])
    except ValueError, error:
        return HttpResponse(unicode(error), mimetype='text/plain', status=400)
    # TODO: Access control and quota checks.
    request.app.put()
    return HttpResponse("""{"status": 200, "statusText": "Saved"}""",
                        mimetype='application/json')


def assert_string(key, value):
    """
    Check that the value is a string.
    """
    if not isinstance(value, basestring):
        raise ValueError("Expected string value for %s." % key)


def assert_string_list(key, value):
    """
    Check that the value is a list of strings.
    """
    if not isinstance(value, list):
        raise ValueError("Expected string list for %s." % key)
    for item in value:
        if not isinstance(item, basestring):
            raise ValueError("Expected string values inside %s list." % key)
