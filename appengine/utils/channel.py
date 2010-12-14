import datetime
import time
import logging

from django.conf import settings
from django.utils import simplejson as json

from google.appengine.api import memcache
from google.appengine.api import channel

from utils.decorators import jsonp, method_required
from utils.json import ModelEncoder, HttpJSONResponse
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
    return HttpJSONResponse(channel_data, status=None)


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
        return HttpJSONResponse(channel_data['subscriptions'], status=None)

    assert request.method == 'PUT'

    # TODO: Add error checking to format of channel data
    subs = json.loads(request.raw_post_data)

    # Expire any old subscriptions NOT in the new set
    for key in channel_data['subscriptions']:
        if key not in subs:
            key = '/'.join((request.app.get_app_id(), key))
            add_subscription(key, session_key, 0)

    for key, sub in subs.items():
        key = '/'.join((request.app.get_app_id(), key))
        expires = channel_data['expires']
        if sub['enabled'] == False:
            expires = 0
            del subs[key]
        add_subscription(key, session_key, expires)

    channel_data['subscriptions'] = subs
    m_key = '~'.join((settings.CHANNEL_PREFIX, 'channel', session_key))
    memcache.set(m_key, channel_data, channel_data['expires'])

    logging.info("Channel saved: %r" % channel_data)

    return HttpJSONResponse({
            'statusText': "Saved",
            'subscriptions': channel_data['subscriptions'],
            })


def add_subscription(key, session_key, expires):
    """
    For each storage key, we store a dictionary of subscribers:
       {session_key: {'expires': expires_time}
    """
    # Keys are paths normalized to end in trailing slash
    if not key.endswith('/'):
        key += '/'
    sub_key = '~'.join((settings.CHANNEL_PREFIX, 'sub', key))
    subscriptions = memcache.get(sub_key) or {}
    subscriptions[session_key] = {'expires': expires}
    save_subscriptions(sub_key, subscriptions)


def save_subscriptions(sub_key, subscriptions):
    """
    Remove any expired subscriptions and save the rest to memcache.
    """
    now = time.time()
    max_expires = 0
    for session_key, sub in subscriptions.items():
        max_expires = max(max_expires, sub['expires'])
        if sub['expires'] < now:
            del subscriptions[session_key]

    logging.info("subscription saved for %s: %r" % (sub_key, subscriptions))
    memcache.set(sub_key, subscriptions, max_expires)


def dispatch_subscriptions(key, method, data):
    """
    Dispatch messages for appid/key
    """
    sub_key = '~'.join((settings.CHANNEL_PREFIX, 'sub', key))
    subscriptions = memcache.get(sub_key)
    if subscriptions is None:
        return

    app_id, path = key.split('/', 1)
    now = time.time()
    fan_out = 0
    save = False
    for session_key, sub in subscriptions.items():
        if sub['expires'] < now:
            save = True
            continue
        fan_out += 1
        # TODO: Use task queues to increase fan_out
        if fan_out > MAX_SUBSCRIBERS:
            logging.info("Too many subscribers (%d) on %s." %
                         (len(subscriptions), key))
            break
        message = json.dumps({'key': path,
                              'app': app_id,
                              'method': method,
                              'data': data},
                             cls=ModelEncoder)
        logging.info("Sending: %s->%s" % (session_key, message))
        channel.send_message(session_key, message)

    if save:
        save_subscriptions(key, subscriptions)


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
        memcache.set(m_key, channel_data, channel_data['expires'])
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
