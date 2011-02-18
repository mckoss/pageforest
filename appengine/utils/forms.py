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


class ValidationError(ValueError):
    """
    An exception class that adds errors dictionary to list specific
    errors for fields in a form.
    """
    def __init__(self, *args):
        super(ValidationError, self).__init__(*args)
        self.errors = None

    def add_error(self, key, message):
        if not self.has_error():
            super(ValidationError, self).__init__(message)
        if not self.errors:
            self.errors = {}
        self.errors[key] = message
        return self

    def has_error(self):
        return str(self) != ''
