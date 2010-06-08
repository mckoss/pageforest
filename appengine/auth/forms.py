import re
import string

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

USERNAME_REGEX_MATCH = re.compile(settings.USERNAME_REGEX).match


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
        logging.info('self %r' % dir(self))
        check_string += '&nbsp;<label for="id_%s">%s</label>' % (
            self.field_id, self.label)
        return mark_safe(check_string)


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


class SignInForm(UsernamePasswordForm):
    """
    User authentication form.
    """
    appauth = forms.BooleanField(
        required=False,
        label="Application",
        widget=LabeledCheckbox(label="Allow access", field_id='appauth'))

    def clean_username(self):
        """
        Check that the user exists.
        """
        username = super(SignInForm, self).clean_username()
        user = User.lookup(username)
        if user is None:
            raise forms.ValidationError("No account for %s." % username)
        self.cleaned_data['user'] = user
        return username

    def clean(self):
        """
        Raise an error if the password does not match.
        """
        user = self.cleaned_data.get('user', None)
        password = self.cleaned_data.get('password', None)
        if user and password and password.lower() != user.password:
            raise forms.ValidationError("Invalid password.")
        return self.cleaned_data
