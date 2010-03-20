import django.shortcuts
from django.template import RequestContext


def render_to_response(request, template, variables):
    """
    Call Django's render_to_response with a RequestContext.
    """
    return django.shortcuts.render_to_response(
        template, variables, context_instance=RequestContext(request))
