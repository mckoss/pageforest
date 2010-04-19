from datetime import datetime, timedelta

from django.shortcuts import redirect
from django.http import HttpResponse

from google.appengine.api import memcache

from utils.shortcuts import render_to_response
from utils.crypto import random64url, hash, sign

from auth.forms import RegistrationForm

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


def challenge(request):
    """
    Generate a random signed challenge for login.
    """
    random = random64url(32)
    expires = datetime.now() + timedelta(seconds=CHALLENGE_EXPIRATION)
    challenge = sign(random, expires, request.app.secret)
    memcache.set(challenge, 'valid', CHALLENGE_EXPIRATION)
    return HttpResponse('"%s"' % challenge, mimetype='application/json')


def login(request):
    """View function placeholder."""
    pass


def logout(request):
    """View function placeholder."""
    pass
