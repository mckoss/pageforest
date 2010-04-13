import logging

from django import forms
from django.shortcuts import redirect
from django.http import HttpResponse
from django.utils import simplejson as json

from utils.shortcuts import render_to_response

from auth.forms import RegistrationForm


def form_errors_json(form):
    if form.is_valid():
        return '{}'
    errors = {}
    fields = {}
    for fieldname in form.fields:
        fields[fieldname] = form[fieldname]
    for key, val in form.errors.iteritems():
        if key == '__all__':
            errors[key] == unicode(val[0])
        elif not isinstance(fields[key].field, forms.FileField):
            html_id = fields[key].field.widget.attrs.get('id')
            html_id = html_id or fields[key].auto_id
            html_id = fields[key].field.widget.id_for_label(html_id)
            errors[html_id] = unicode(val[0])
    logging.info(errors)
    return json.dumps(errors)


def register(request, ajax=None):
    """Create a user account on PageForest."""
    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if ajax:
            return HttpResponse(form_errors_json(form),
                                mimetype='application/json')
        if form.is_valid():
            form.save()
            return redirect('/auth/welcome/')
    else:
        form = RegistrationForm()
    return render_to_response(request, 'auth/register.html', locals())


def login(request):
    """View function placeholder."""
    pass


def logout(request):
    """View function placeholder."""
    pass
