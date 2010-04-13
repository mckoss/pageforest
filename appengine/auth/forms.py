import logging

from django import forms
from django.conf import settings
from django.utils import simplejson as json

from auth.models import User

KEYBOARD_ROWS = """
`1234567890-=
qwertyuiop[]\
qwertzuiop
asdfghjkl;'
zxcvbnm,./
yxcvbnm,.-
""".split()


class RegistrationForm(forms.Form):
    username = forms.RegexField(
        regex=r'^[A-Za-z0-9]+$', max_length=30,
        error_messages={'invalid': "Username must be alphanumeric."})
    email = forms.EmailField(max_length=75)
    password = forms.CharField(min_length=6, max_length=40,
        widget=forms.PasswordInput(render_value=False))
    repeat = forms.CharField(max_length=40,
        widget=forms.PasswordInput(render_value=False))
    tos = forms.BooleanField(
        label="Terms of Service",
        error_messages={'required': "You must agree to the Terms of Service."})

    def clean_username(self):
        """
        Validate that the username is available.
        """
        username = self.cleaned_data['username']
        key_name = username.lower()
        if key_name in settings.RESERVED_USERNAMES:
            raise forms.ValidationError("This username is reserved.")
        if User.get_by_key_name(key_name):
            raise forms.ValidationError("This username is already taken.")
        return username

    def clean_password(self):
        """
        Check that the password is not too silly.
        """
        password = self.cleaned_data['password']
        if password.isdigit() or password == len(password) * password[0]:
            raise forms.ValidationError("This password is too simple.")
        lower = password.lower()
        backwards = lower[::-1]
        for row in KEYBOARD_ROWS:
            if lower in row or backwards in row:
                raise forms.ValidationError("This password is too simple.")
        return password

    def clean(self):
        """
        Verify that password and repeat are the same.
        """
        if 'password' in self.cleaned_data and 'repeat' in self.cleaned_data:
            password = self.cleaned_data['password']
            repeat = self.cleaned_data['repeat']
            if password != repeat:
                raise forms.ValidationError(
                    "The two password fields are not the same.")
        return self.cleaned_data

    def save(self):
        """
        Create a new user with the form data.
        """
        username = self.cleaned_data['username']
        user = User(key_name=username.lower(),
                    username=username,
                    email=self.cleaned_data['email'])
        user.set_password(self.cleaned_data['password'])
        user.put()
        return user

    def errors_json(self):
        """
        Validate and return form error messages as JSON.
        """
        if self.is_valid():
            return '{}'
        errors = {}
        fields = {}
        for fieldname in self.fields:
            fields[fieldname] = self[fieldname]
        for key, val in self.errors.iteritems():
            if key == '__all__':
                errors[key] == unicode(val[0])
            elif not isinstance(fields[key].field, forms.FileField):
                html_id = fields[key].field.widget.attrs.get('id')
                html_id = html_id or fields[key].auto_id
                html_id = fields[key].field.widget.id_for_label(html_id)
                errors[html_id] = unicode(val[0])
        logging.info(errors)
        return json.dumps(errors)
