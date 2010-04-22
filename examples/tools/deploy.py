#!/usr/bin/env python

import os
import sys
import hmac
import hashlib
import urllib2

META_FILENAME = 'app.json'
SERVER = 'keyvalue.localhost:8080'
if len(sys.argv) > 1:
    SERVER = sys.argv[1]


class PutRequest(urllib2.Request):
    """Request to upload a file with HTTP PUT."""

    def get_method(self):
        return 'PUT'


def credentials():
    if os.path.exists('.passwd'):
        return open('.passwd').readline().strip().split(':')
    from getpass import getpass
    return raw_input("Username: "), getpass("Password: ")


def hmac_sha1(key, message):
    return hmac.new(key, message, hashlib.sha1).hexdigest()


def login(username, password):
    url = 'http://auth.%s/challenge/' % SERVER
    challenge = urllib2.urlopen(url).read()
    userpass = hmac_sha1(password, username.lower())
    data = '$'.join((username, challenge, hmac_sha1(userpass, challenge)))
    url = 'http://auth.%s/login/' % SERVER
    return urllib2.urlopen(url, data).read()


def upload(session_key, url, filename):
    data = open(filename).read()
    request = PutRequest(url, data)
    request.add_header('Cookie', 'sessionkey=' + session_key)
    print url
    print urllib2.urlopen(request).read()


def main():
    username, password = credentials()
    session_key = login(username, password)
    if not os.path.exists(META_FILENAME):
        sys.exit('Could not find ' + META_FILENAME)
    url = 'http://%s/.app' % SERVER
    upload(session_key, url, META_FILENAME)
    for dirpath, dirnames, filenames in os.walk('.'):
        for dirname in dirnames:
            if dirname.startswith('.'):
                dirnames.remove(dirname)
        urlpath = dirpath.replace('\\', '/') + '/'
        if urlpath.startswith('./'):
            urlpath = urlpath[2:]
        for filename in filenames:
            if filename.startswith('.') or filename == META_FILENAME:
                continue
            url = 'http://%s/.app/%s%s' % (SERVER, urlpath, filename)
            upload(session_key, url, filename)


if __name__ == '__main__':
    try:
        main()
    except urllib2.HTTPError, e:
        print e
        for line in e.fp:
            print line.rstrip()
