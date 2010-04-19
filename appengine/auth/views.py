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
    ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
    memcache.set(challenge, ip, CHALLENGE_EXPIRATION)
    return HttpResponse(challenge, mimetype='text/plain')


@jsonp
@require_method('POST')
def login(request):
    """User login after challenge."""
    parts = request.raw_post_data.split(crypto.SEPARATOR)
    # Check that the expiration time is in the future.
    expires = datetime.strptime(parts[2], "%Y-%m-%dT%H:%M:%SZ")
    if expires < datetime.now():
        return HttpResponse("The challenge is expired.",
                            content_type='text/plain', status=403)
    # Check that the challenge is unused and was generated recently.
    challenge = crypto.join(*parts[1:4])
    challenge_ip = memcache.get(challenge)
    if challenge_ip is None:
        return HttpResponse("The challenge is unknown.",
                            content_type='text/plain', status=403)
    memcache.delete(challenge)
    # Check that the IP address matches.
    request_ip = request.META.get('REMOTE_ADDR', '0.0.0.0')
    if request_ip != challenge_ip:
        return HttpResponse("The challenge was issued to a different IP.",
                            content_type='text/plain', status=403)
    # Check that the username exists.
    username = parts[0]
    user = User.get_by_key_name(username.lower())
    if user is None:
        return HttpResponse("The username '%s' is unknown." % username,
                            content_type='text/plain', status=403)
    # Check the password signature.
    signed = crypto.sign(challenge, user.password)
    joined = crypto.join(user.username.lower(), signed)
    if request.raw_post_data != joined:
        return HttpResponse("The password signature is incorrect.",
                            content_type='text/plain', status=403)
    # Generate a session key for the next 24 hours.
    key = crypto.join(user.password, request.app.secret)
    expires = datetime.now() + timedelta(hours=24)
    session_key = crypto.sign(request.app_id, username, expires, key)
    expires = datetime.now() + timedelta(days=30)
    reauth_cookie = crypto.sign(request.app_id, username, expires, key)
    response = HttpResponse(session_key, content_type='text/plain')
    response['Set-Cookie'] = 'reauth=' + reauth_cookie
    return response


def logout(request):
    """View function placeholder."""
    pass
