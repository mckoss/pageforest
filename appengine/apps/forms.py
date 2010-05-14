import re
import string

from django import forms
from django.conf import settings

from utils.forms import AjaxForm

from apps.models import App

APP_ID_REGEX_MATCH = re.compile(settings.APP_ID_REGEX).match


class AppForm(AjaxForm):
    app_id = forms.CharField(required=True)
    title = forms.CharField(required=True)
    url = forms.CharField(required=True)
    trusted_urls = forms.CharField()
    readers = forms.CharField()
    writers = forms.CharField()
    tags = forms.CharField()

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
        if not APP_ID_REGEX_MATCH(app_id):
            raise forms.ValidationError(
                "App_Id must contain only letters, numbers and dashes.")
        if app_id in settings.RESERVED_APPS:
            raise forms.ValidationError("This app ID is reserved.")
        return app_id

    def save(self):
        """
        Create a new app with the form data.
        """
        app = App(key_name=self.cleaned_data['app_id'],
                  title=self.cleaned_data['title'],
                  url=self.cleaned_data['url'],
                  trusted_urls=self.cleaned_data['trusted_urls'],
                  tags=self.cleaned_data['tags'],
                  readers=self.cleaned_data['readers'],
                  writers=self.cleaned_data['writers'])
        app.put()
        return app
