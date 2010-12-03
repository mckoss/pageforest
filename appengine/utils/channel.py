import datetime
import time
import logging

from django.conf import settings
from django.http import HttpResponse, HttpResponseBadRequest
from django.utils import simplejson as json

from google.appengine.api import memcache
from google.appengine.api import channel

from utils.decorators import jsonp, method_required
from utils.json import ModelEncoder
from utils import crypto

from auth.decorators import login_required

CHANNEL_LIFETIME = 60 * 60 * 2
MAX_SUBSCRIBERS = 30


@jsonp
@method_required('GET')
@login_required
def get_channel(request, extra):
    """
    Return the channel id that the client can use to receive notifications
    from the server.
    """
    session_key = get_session_key(request)
    channel_data = get_session_channel(session_key)

    return HttpResponse(json.dumps(channel_data,
                                   indent=2,
                                   cls=ModelEncoder),
                        mimetype=settings.JSON_MIMETYPE)


@jsonp
@method_required('GET', 'PUT')
@login_required
def subscriptions(request, extra):
    """
    Read or write the subscriptions being monitored by the current
    channel.
    """
    session_key = get_session_key(request)
    channel_data = get_session_channel(session_key)
    if request.method == 'GET':
        return HttpResponse(json.dumps(channel_data['subscriptions'],
                                       indent=2,
                                       cls=ModelEncoder),
                            mimetype=settings.JSON_MIMETYPE)

    assert request.method == 'PUT'

    # TODO: Add error checking to format of channel data
    channel_data['subscriptions'] = json.loads(request.raw_post_data)

    # TODO: Expire any old subscriptions NOT in the new set
    for key, sub in channel_data['subscriptions'].items():
        add_subscription(key, session_key, channel_data['expires'])

    m_key = '~'.join((settings.CHANNEL_PREFIX, 'channel', session_key))
    memcache.set(m_key, channel_data)

    json_result = json.dumps({
            'status': 200,
            'statusText': "Saved",
            'subscriptions': channel_data['subscriptions']
            }, cls=ModelEncoder)

    return HttpResponse(json_result, mimetype=settings.JSON_MIMETYPE)


def add_subscription(key, session_key, expires):
    """
    For each key, we store a dictionary of subscribers:
       {session_key: {'expires': expires_time, ...}
    """
    sub_key = '~'.join((settings.CHANNEL_PREFIX, 'sub', key))
    subscriptions = memcache.get(sub_key) or {}
    subscriptions[session_key] = {'expires': expires}
    save_subscriptions(sub_key, subscriptions)


def save_subscriptions(sub_key, subscriptions):
    """
    Remove any expired subscriptions and save the rest to memcache.
    """
    now = time.time()
    for key, sub in subscriptions.items():
        if sub['expires'] < now:
            del subscriptions[key]

    memcache.set(sub_key, subscriptions)


def dispatch_subscriptions(request, key, data):
    sub_key = '~'.join((settings.CHANNEL_PREFIX, 'sub', key))
    subscriptions = memcache.get(sub_key)
    if subscriptions is None:
        return

    now = time.time()
    fan_out = 0
    for key, sub in subscriptions.items():
        if sub['expires'] < now:
            continue
        fan_out += 1
        # TODO: Use task queues to increase fan_out
        if fan_out > MAX_SUBSCRIBERS:
            logging.info("Too many subscribers (%d) on %s." %
                         (len(subscriptions), key))
            break
        message = json.dumps({'key': key,
                              'data': data},
                             cls=ModelEncoder)
        channel.send_message(sub.key, message)


def get_session_channel(session_key):
    """
    Get the (cached) channel info for the current user's session.
    """
    m_key = '~'.join((settings.CHANNEL_PREFIX, 'channel', session_key))
    channel_data = memcache.get(m_key)

    if channel_data is not None:
        update_lifetime(channel_data)

    # If no valid channel, or if it expires in less than
    # 5 minutes, make a new one.
    if channel_data == None or channel_data['lifetime'] < 5 * 60:
        token = channel.create_channel(session_key)
        channel_data = {'created': datetime.datetime.now(),
                        'expires': int(time.time() + CHANNEL_LIFETIME),
                        'token': token,
                        'subscriptions': {}}
        memcache.set(m_key, channel_data)
        update_lifetime(channel_data)

    return channel_data


def get_session_key(request):
    """
    Don't leak the session_key through the channel token - encrypt it.
    """
    session_key = crypto.hmac_sha1(
        request.COOKIES[settings.SESSION_COOKIE_NAME],
        request.user.password)
    return session_key


def update_lifetime(channel_data):
    """
    Update the channel lifetime.
    """
    channel_data['lifetime'] = int(channel_data['expires'] - time.time())
