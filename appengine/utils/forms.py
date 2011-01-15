from django import forms
from django.utils import simplejson as json


class AjaxForm(forms.Form):

    def errors_dict(self):
        """
        Validate and return form error messages as JSON.
        """
        if self.is_valid():
            return '{}'
        errors = {}
        for key, val in self.errors.iteritems():
            errors[key] = [unicode(msg) for msg in val]
        return errors

    # REVIEW: Probably don't need this
    def errors_json(self):
        return json.dumps(self.errors_dict())
