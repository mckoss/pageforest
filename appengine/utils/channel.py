import datetime
import time
import logging

from django.conf import settings
from django.utils import simplejson as json

from google.appengine.api import memcache
from google.appengine.api import channel

from utils.decorators import jsonp, method_required
from utils.json import ModelEncoder, HttpJSONResponse
from utils.shortcuts import project
from utils import crypto

from auth.decorators import login_required

CHANNEL_LIFETIME = 60 * 60 * 2
MAX_SUBSCRIBERS = 30


@jsonp
@method_required('GET')
def get_channel(request, extra):
    """
    Return the channel id that the client can use to receive notifications
    from the server.
    """
    channel_key = get_channel_key(request)
    channel_data = get_session_channel(channel_key)
    return HttpJSONResponse(channel_data, status=None)


@jsonp
@method_required('GET', 'PUT')
def subscriptions(request, extra):
    """
    Read or write the subscriptions being monitored by the current
    channel.

    Note: docid's in keys should be lower case (case insensitive).
    """
    channel_key = get_channel_key(request)
    channel_data = get_session_channel(channel_key)
    if request.method == 'GET':
        return HttpJSONResponse(channel_data['subscriptions'], status=None)

    assert request.method == 'PUT'

    # TODO: Add error checking to format of channel data
    subs_load = json.loads(request.raw_post_data)

    # Ensure that all document keys are canonical (docid lowercase)
    subs = {}
    for key in subs_load:
        docid, path = key.split('/', 1)
        canonical_key = '/'.join((docid.lower(), path))
        subs[canonical_key] = subs_load[key]

    # Expire any old subscriptions NOT in the new set
    for key in channel_data['subscriptions']:
        if key not in subs:
            key = '/'.join((request.app.get_app_id(), key))
            add_subscription(key, channel_key, 0)

    for key, sub in subs.items():
        key = '/'.join((request.app.get_app_id(), key))
        expires = channel_data['expires']
        if sub['enabled'] == False:
            expires = 0
            del subs[key]
        add_subscription(key, channel_key, expires, project(sub, ['children']))

    channel_data['subscriptions'] = subs
    m_key = '~'.join((settings.CHANNEL_PREFIX, 'channel', channel_key))
    memcache.set(m_key, channel_data, channel_data['expires'])

    logging.info("Channel saved: %r" % channel_data)

    return HttpJSONResponse({
            'statusText': "Saved",
            'subscriptions': channel_data['subscriptions'],
            })


def add_subscription(key, channel_key, expires, options=None):
    """
    For each storage key, we store a dictionary of subscribers:
       {channel_key: {'expires': expires_time}, ...

    options is an (optional) dictionary that can contain:

        children: True - For a document key, subscribe to all
        child blobs.
    """
    # Keys are paths normalized to end in trailing slash
    if not key.endswith('/'):
        key += '/'
    sub_key = '~'.join((settings.CHANNEL_PREFIX, 'sub', key))
    subscriptions = memcache.get(sub_key) or {}
    subscriptions[channel_key] = {'expires': expires}
    if options:
        subscriptions[channel_key].update(options)
    save_subscriptions(sub_key, subscriptions)


def save_subscriptions(sub_key, subscriptions):
    """
    Remove any expired subscriptions and save the rest to memcache.
    """
    now = time.time()
    max_expires = 0
    for channel_key, sub in subscriptions.items():
        max_expires = max(max_expires, sub['expires'])
        if sub['expires'] < now:
            del subscriptions[channel_key]

    logging.info("subscription saved for %s: %r" % (sub_key, subscriptions))
    memcache.set(sub_key, subscriptions, max_expires)


def dispatch_subscriptions(key, method, data, original_key=None):
    """
    Dispatch messages for appid/key.

    For blob keys, we also dispatch children subscriptions on the parent
    document.
    """
    app_id, docid, path = key.split('/', 2)

    # Blob changed - also dispatch for parent document.
    if path != '':
        dispatch_subscriptions('%s/%s/' % (app_id, docid), method, data, key)

    sub_key = '~'.join((settings.CHANNEL_PREFIX, 'sub', key))
    subscriptions = memcache.get(sub_key)
    if subscriptions is None:
        return

    # Update path to be original one for children subscriptions
    if original_key:
        path = original_key.split('/', 2)[2]
    else:
        original_key = key

    now = time.time()
    fan_out = 0
    save = False
    for channel_key, sub in subscriptions.items():
        if sub['expires'] < now:
            save = True
            continue
        if original_key != key and 'children' not in sub:
            continue
        fan_out += 1
        # TODO: Use task queues to increase fan_out
        if fan_out > MAX_SUBSCRIBERS:
            logging.info("Too many subscribers (%d) on %s." %
                         (len(subscriptions), key))
            break
        message = json.dumps({'key': '/'.join((docid, path)),
                              'app': app_id,
                              'method': method,
                              'data': data},
                             cls=ModelEncoder)
        logging.info("Sending: %s->%s" % (channel_key, message))
        channel.send_message(channel_key, message)

    if save:
        save_subscriptions(key, subscriptions)


def get_session_channel(channel_key):
    """
    Get the (cached) channel info for the current user's session.
    """
    m_key = '~'.join((settings.CHANNEL_PREFIX, 'channel', channel_key))
    channel_data = memcache.get(m_key)

    if channel_data is not None:
        update_lifetime(channel_data)

    # If no valid channel, or if it expires in less than
    # 5 minutes, make a new one.
    if channel_data == None or channel_data['lifetime'] < 5 * 60:
        token = channel.create_channel(channel_key)
        channel_data = {'created': datetime.datetime.now(),
                        'expires': int(time.time() + CHANNEL_LIFETIME),
                        'token': token,
                        'subscriptions': {}}
        memcache.set(m_key, channel_data, channel_data['expires'])
        update_lifetime(channel_data)

    return channel_data


def get_channel_key(request):
    """
    The client must provide the channel key as a (hopefully) globally unique and
    un-guessable string.
    """
    if 'uid' not in request.GET:
        raise ValueError("Missing unique client id (?uid=...) from request.")
    return request.GET['uid']


def update_lifetime(channel_data):
    """
    Update the channel lifetime.
    """
    channel_data['lifetime'] = int(channel_data['expires'] - time.time())
