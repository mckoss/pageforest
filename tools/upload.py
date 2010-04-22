#!/usr/bin/env python

import re
import os
import sys
import hmac
import hashlib
import urllib2

META_FILENAME = 'app.json'
CONFIG_FILENAME = '.url'
IGNORE_FILENAMES = ''.split()


class PutRequest(urllib2.Request):
    """Request to upload a file with HTTP PUT."""

    def get_method(self):
        return 'PUT'


def hmac_sha1(key, message):
    return hmac.new(key, message, hashlib.sha1).hexdigest()


def login(username, password, hostname):
    url = 'http://auth.%s/challenge' % hostname
    challenge = urllib2.urlopen(url).read()
    userpass = hmac_sha1(password, username.lower())
    signature = hmac_sha1(userpass, challenge)
    response = '$'.join((username, challenge, signature))
    url = 'http://auth.%s/login/%s' % (hostname, response)
    return urllib2.urlopen(url).read()


def upload(session_key, url, filename):
    data = open(filename).read()
    request = PutRequest(url, data)
    request.add_header('Cookie', 'sessionkey=' + session_key)
    print url
    print urllib2.urlopen(request).read()


def config():
    username = password = hostname = ''
    if os.path.exists(CONFIG_FILENAME):
        parts = open(CONFIG_FILENAME).readline().split('/')
        if len(parts) > 2 and parts[0] == 'http:' and parts[1] == '':
            hostname = parts[2]
    if '@' in hostname:
        username, hostname = hostname.split('@', 1)
    if ':' in username:
        username, password = username.split(':', 1)
    if not hostname:
        hostname = raw_input("Hostname: ")
    if not username:
        username = raw_input("Username: ")
    if not password:
        from getpass import getpass
        password = getpass("Password: ")
    return username, password, hostname


def save_config(username, password, hostname):
    yesno = raw_input("Save %s file (Y/n)? " % CONFIG_FILENAME) or 'y'
    if yesno.lower().startswith('y'):
        open(CONFIG_FILENAME, 'w').write('http://%s:%s@%s/\n' % (
                username, password, hostname))


def main():
    username, password, hostname = config()
    session_key = login(username, password, hostname)
    if not os.path.exists(META_FILENAME):
        sys.exit('Could not find ' + META_FILENAME)
    for dirpath, dirnames, filenames in os.walk('.'):
        for dirname in dirnames:
            if dirname.startswith('.'):
                dirnames.remove(dirname)
        urlpath = dirpath.replace('\\', '/') + '/'
        if urlpath.startswith('./'):
            urlpath = urlpath[2:]
        for filename in filenames:
            if filename.startswith('.') or filename in IGNORE_FILENAMES:
                continue
            url = 'http://%s/%s%s' % (hostname, urlpath, filename)
            upload(session_key, url, filename)
    if not os.path.exists(CONFIG_FILENAME):
        save_config(username, password, hostname)


if __name__ == '__main__':
    try:
        main()
    except urllib2.HTTPError, e:
        print e
        for line in e.fp.readlines()[:10]:
            print line.rstrip()
