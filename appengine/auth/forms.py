import re
import string
import logging

from django import forms
from django.conf import settings
from django.utils.safestring import mark_safe

from utils.forms import AjaxForm

from auth.models import User

KEYBOARD_ROWS = """
`1234567890-=
qwertyuiop[]\
qwertzuiop
asdfghjkl;'
zxcvbnm,./
yxcvbnm,.-
""".split()

USERNAME_REGEX_MATCH = re.compile('^%s$' % settings.USERNAME_REGEX).match


class LabeledCheckbox(forms.CheckboxInput):
    """
    Checkbox with a label.
    """

    def __init__(self, attrs=None, label=None, field_id=None):
        super(LabeledCheckbox, self).__init__(attrs)
        self.label = label
        self.field_id = field_id

    def render(self, name, value, attrs=None):
        """
        Generate HTML for a checkbox with a label.
        """
        check_string = super(LabeledCheckbox, self).render(name, value, attrs)
        import logging
        check_string += '&nbsp;<label for="id_%s">%s</label>' % (
            self.field_id, self.label)
        return mark_safe(check_string)


class ReadonlyTextInput(forms.TextInput):
    def render(self, name, value, attrs=None):
        if self.attrs.get('readonly', False):
            if value is None:
                value = ''
            return unicode(value)
        return super(ReadonlyTextInput, self).render(name, value, attrs)


class ReadonlyCheckboxInput(forms.CheckboxInput):
    def render(self, name, value, attrs=None):
        if self.attrs.get('readonly', False):
            return unicode(value)
        return super(ReadonlyCheckboxInput, self).render(name, value, attrs)


class Static(forms.Widget):
    def render(self, name, value, attrs=None):
        if value is None:
            value = ''
        return unicode(value)


class UsernamePasswordForm(AjaxForm):
    """
    Reusable form class with a username and password field.
    Both SignUpForm and SignInForm are subclasses of this.
    """
    username = forms.CharField(min_length=2, max_length=30,
        widget=forms.TextInput(attrs={'class': 'focus'}))
    password = forms.CharField(min_length=40, max_length=40,
        widget=forms.PasswordInput(render_value=False))

    def clean_username(self):
        """
        Validate the username and return helpful error messages.
        """
        username = self.cleaned_data['username']
        key_name = username.lower()
        if username[0] not in string.ascii_letters:
            raise forms.ValidationError(
                "Username must start with a letter.")
        if username[-1] not in string.ascii_letters + string.digits:
            raise forms.ValidationError(
                "Username must end with a letter or number.")
        if not USERNAME_REGEX_MATCH(username):
            raise forms.ValidationError(
                "Username must contain only letters, numbers and dashes.")
        if key_name in settings.RESERVED_USERNAMES:
            raise forms.ValidationError("This username is reserved.")
        return username


class SignUpForm(UsernamePasswordForm):
    """
    Account registration form for new users, with helpful error messages.
    """
    repeat = forms.CharField(max_length=40, label="Repeat password",
        widget=forms.PasswordInput(render_value=False), required=False)
    email = forms.EmailField(max_length=75, label="Email address")
    tos = forms.BooleanField(
        label="Terms of Service",
        widget=LabeledCheckbox(label="I agree", field_id='tos'),
        error_messages={'required':
          mark_safe('You must agree to the <a href="http://' +
                    settings.DEFAULT_DOMAIN + '/terms-of-service' +
                    '" target="_blank">Terms of Service</a>.')})

    def clean_username(self):
        """
        Verify that the username is available.
        """
        username = super(SignUpForm, self).clean_username()
        if User.lookup(username):
            raise forms.ValidationError("This username is already taken.")
        return username

    def save(self):
        """
        Create a new user with the form data.
        """
        username = self.cleaned_data['username']
        user = User(key_name=username.lower(),
                    username=username,
                    email=self.cleaned_data['email'],
                    password=self.cleaned_data['password'])
        user.put()
        return user


class ProfileForm(AjaxForm):
    """
    Edit account information for existing users.
    """
    username = forms.CharField(min_length=2, max_length=30,
                               widget=Static)
    email = forms.EmailField(max_length=75, label="Email address",
                             widget=Static)
    password = forms.CharField(min_length=40, max_length=40,
                               widget=forms.PasswordInput(render_value=False))
    repeat = forms.CharField(max_length=40, label="Repeat password",
                             widget=forms.PasswordInput(render_value=False), required=False)
    is_admin = forms.BooleanField(label="Admin",
                                  widget=ReadonlyCheckboxInput)
    max_apps = forms.IntegerField(label="Max Apps",
                                  widget=ReadonlyTextInput)

    def enable_fields(self, user):
        if not (user.is_admin or user.get_username() in settings.SUPER_USERS):
            self.fields['is_admin'].widget.attrs['readonly'] = True
            self.fields['max_apps'].widget.attrs['readonly'] = True

    def save(self, user):
        """
        Create a new user with the form data.
        """
        user.max_apps = self.cleaned_data['max_apps']
        user.is_admin = self.cleaned_data['is_admin']
        user.put()
