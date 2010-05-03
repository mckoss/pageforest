from django import forms
from django.conf import settings
from django.utils import simplejson as json
from django.utils.safestring import mark_safe

from auth.models import User

KEYBOARD_ROWS = """
`1234567890-=
qwertyuiop[]\
qwertzuiop
asdfghjkl;'
zxcvbnm,./
yxcvbnm,.-
""".split()

username_error = "Username must begin with a letter and contain only " + \
    "numbers, letters and dashes."


class LabeledCheckbox(forms.CheckboxInput):

    def __init__(self, attrs=None, label=None, id=None):
        super(LabeledCheckbox, self).__init__(attrs)
        self.label = label
        self.id = id

    def render(self, name, value, attrs=None):
        check_string = super(LabeledCheckbox, self).render(name, value, attrs)
        import logging
        logging.info('self %r' % dir(self))
        check_string += '&nbsp;<label for="id_%s">%s</label>' % \
            (self.id, self.label)
        return mark_safe(check_string)


class RegistrationForm(forms.Form):
    username = forms.RegexField(
        regex=settings.USERNAME_REGEX,
        min_length=2, max_length=30,
        error_messages={'invalid': username_error})
    password = forms.CharField(min_length=6, max_length=40,
        widget=forms.PasswordInput(render_value=False))
    repeat = forms.CharField(max_length=40, label="Repeat password",
        widget=forms.PasswordInput(render_value=False))
    email = forms.EmailField(max_length=75, label="Email address")
    tos = forms.BooleanField(
        label="Terms of Service",
        widget=LabeledCheckbox(label="I agree", id='tos'),
        error_messages={'required':
          mark_safe('You must agree to the <a href="http://' +
                    settings.DEFAULT_DOMAIN + '/' + 'terms-of-service">' +
                    'Terms of Service</a>.')})

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
        # TODO: Move this to client-side checks - and don't send password in
        # clear - send the HMAC, directly.
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

    def save(self, request):
        """
        Create a new user with the form data.
        """
        username = self.cleaned_data['username']
        user = User(key_name=username.lower(),
                    username=username,
                    email=self.cleaned_data['email'])
        user.set_password(self.cleaned_data['password'])
        user.put()
        user.send_email_verification(request)
        return user

    def errors_json(self):
        """
        Validate and return form error messages as JSON.
        """
        if self.is_valid():
            return '{}'
        errors = {}
        for key, val in self.errors.iteritems():
            errors[key] = [unicode(msg) for msg in val]
        return json.dumps(errors)


class SignInForm(forms.Form):
    username = forms.RegexField(
        regex=settings.USERNAME_REGEX,
        min_length=2, max_length=30,
        error_messages={'invalid': username_error})
    password = forms.CharField(
        widget=forms.PasswordInput(render_value=False))
    app_auth = forms.BooleanField(
        label="Application",
        widget=LabeledCheckbox(label="Allow access", id='app_auth'))

    # REVIEW: Is it proper to stash data in the form for callers
    # to use (when form is_valid)?
    user = None

    def clean_username(self):
        username = self.cleaned_data['username']
        username = username.lower()
        if username in settings.RESERVED_USERNAMES:
            raise forms.ValidationError("This username is reserved.")
        self.user = User.lookup(username)
        if self.user is None:
            raise forms.ValidationError("No account for %s." % username)
        return username

    def clean(self):
        """
        Raise an error if the user does not exist OR the password for that
        user does not match - but don't reveal the reason to the user.
        """
        if 'username' in self.cleaned_data and 'password' in self.cleaned_data:
            if self.user is None or \
                not self.user.check_password(self.cleaned_data['password']):
                raise forms.ValidationError("Invalid username or password.")
        return self.cleaned_data
