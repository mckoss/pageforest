from datetime import datetime, timedelta

from django.shortcuts import redirect
from django.http import HttpResponse

from google.appengine.api import memcache

from utils.decorators import jsonp, require_method
from utils.shortcuts import render_to_response
from utils import crypto

from auth.forms import RegistrationForm
from auth.models import User

CHALLENGE_EXPIRATION = 60  # Seconds.


def register(request, ajax=None):
    """Create a user account on PageForest."""
    if request.method == 'POST':
        form = RegistrationForm(request.POST)
        if ajax:
            return HttpResponse(form.errors_json(),
                                mimetype='application/json')
        if form.is_valid():
            form.save()
            return redirect('/auth/welcome/')
    else:
        form = RegistrationForm()
    return render_to_response(request, 'auth/register.html', locals())


@jsonp
@require_method('GET')
def challenge(request):
    """Generate a random signed challenge for login."""
    random_key = crypto.random64url(32)
    expires = datetime.now() + timedelta(seconds=CHALLENGE_EXPIRATION)
    challenge = crypto.sign(random_key, expires, request.app.secret)
    memcache.set(challenge, 'valid', CHALLENGE_EXPIRATION)
    return HttpResponse(challenge, mimetype='text/plain')


@jsonp
@require_method('POST')
def login(request):
    """User login after challenge."""
    print request.raw_post_data
    parts = request.raw_post_data.split(crypto.SEPARATOR)
    # Print post data (for debugging).
    print 'username:', parts[0]
    print 'random:', parts[1]
    print 'expires:', parts[2]
    print 'server:', parts[3]
    print 'client:', parts[4]
    # Check that the expiration time is in the future.
    expires = datetime.strptime(parts[2], "%Y-%m-%dT%H:%M:%SZ")
    if expires < datetime.now():
        return HttpResponse("The challenge is expired.",
                            content_type='text/plain', status=412)
    print 'not expired'
    # Check that the challenge is unused and was generated recently.
    challenge = crypto.join(*parts[1:4])
    if memcache.get(challenge) is None:
        return HttpResponse("The challenge is unknown.",
                            content_type='text/plain', status=412)
    print 'challenge valid'
    # Check that the username exists.
    username = parts[0].lower()
    user = User.get_by_key_name(username)
    if user is None:
        return HttpResponse("The username '%s' is unknown.",
                            content_type='text/plain', status=412)
    print 'user found'
    print 'password:', user.password
    # Check the password signature.
    signed = crypto.sign(challenge, user.password)
    joined = crypto.join(user.username.lower(), signed)
    print 'joined:', joined
    if request.raw_post_data != joined:
        return HttpResponse("The password signature is incorrect.",
                            content_type='text/plain', status=412)
    print 'password correct'
    # Generate a session key for the next 24 hours.
    expires = datetime.now() + timedelta(hours=24)
    key = crypto.join(user.password, request.app.secret)
    session_key = crypto.sign(request.app_id, username, expires, key)
    return HttpResponse(session_key, content_type='text/plain')


def logout(request):
    """View function placeholder."""
    pass
