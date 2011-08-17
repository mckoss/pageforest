import re
import string

from django import forms
from django.conf import settings

from utils import crypto
from utils.forms import AjaxForm

from apps.models import App

APP_ID_REGEX_COMPILED = re.compile('^%s$' % settings.APP_ID_REGEX)


class WideTextInput(forms.TextInput):

    def __init__(self, *args, **kwargs):
        if 'attrs' not in kwargs:
            kwargs['attrs'] = {}
        classes = kwargs['attrs'].get('class', '').split()
        if 'wide' not in classes:
            classes.append('wide')
        kwargs['attrs']['class'] = ' '.join(classes)
        super(WideTextInput, self).__init__(*args, **kwargs)


class AppForm(AjaxForm):
    app_id = forms.CharField(label='App ID', max_length=32)
    title = forms.CharField(widget=WideTextInput)
    tags = forms.CharField(required=False, widget=WideTextInput)
    readers = forms.CharField(required=False, widget=WideTextInput)
    writers = forms.CharField(required=False, widget=WideTextInput)
    referers = forms.CharField(required=False, widget=forms.Textarea(
            attrs={'class': 'short'}))

    def clean_app_id(self):
        """
        Validate the app_id and return helpful error messages.
        """
        app_id = self.cleaned_data['app_id']
        if app_id != app_id.lower():
            raise forms.ValidationError(
                "App ID must be all lowercase.")
        if app_id[0] not in string.lowercase:
            raise forms.ValidationError(
                "App ID must start with a letter.")
        if app_id[-1] not in string.lowercase + string.digits:
            raise forms.ValidationError(
                "App ID must end with a letter or number.")
        if not APP_ID_REGEX_COMPILED.match(app_id):
            raise forms.ValidationError(
                "App ID can only contain letters, numbers and dashes.")
        if app_id in settings.RESERVED_APPS:
            raise forms.ValidationError("This app ID is reserved.")
        if App.get_by_key_name(app_id):
            raise forms.ValidationError("This app ID is already taken.")
        return app_id

    def clean_tags(self):
        tags = self.cleaned_data['tags']
        return tags

    def save(self):
        """
        Create a new app with the form data.
        """
        app = App.create(self.cleaned_data['app_id'],
            username=self.cleaned_data['owner'],
            title=self.cleaned_data['title'],
            tags=self.cleaned_data['tags'].split(),
            readers=self.cleaned_data['readers'].split(),
            writers=self.cleaned_data['writers'].split(),
            referers=self.cleaned_data['referers'].split())
        return app
