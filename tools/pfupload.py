#!/usr/bin/env python

import re
import os
import sys
import hmac
import hashlib
import urllib2
from optparse import OptionParser

META_FILENAME = 'app.json'
CONFIG_FILENAME = '.url'
IGNORE_FILENAMES = ''.split()


class PutRequest(urllib2.Request):
    """Request to upload a file with HTTP PUT."""

    def get_method(self):
        return 'PUT'


def hmac_sha1(key, message):
    return hmac.new(key, message, hashlib.sha1).hexdigest()


def login(options):
    url = 'http://%s/auth/challenge' % options.server
    challenge = urllib2.urlopen(url).read()
    userpass = hmac_sha1(options.password, options.username.lower())
    signature = hmac_sha1(userpass, challenge)
    reply = '/'.join((options.username, challenge, signature))
    url = 'http://%s/auth/verify/%s' % (options.server, reply)
    return urllib2.urlopen(url).read()


def load_config(options):
    hostname = username = password = ''
    parts = open(CONFIG_FILENAME).readline().split('/')
    if len(parts) > 2 and parts[0] == 'http:' and parts[1] == '':
        hostname = parts[2]
    if '@' in hostname:
        username, hostname = hostname.split('@', 1)
    if ':' in username:
        username, password = username.split(':', 1)
    options.username = username
    options.password = password
    if not options.server:
        options.server = hostname


def save_config(options):
    yesno = raw_input("Save %s file (Y/n)? " % CONFIG_FILENAME) or 'y'
    if yesno.lower().startswith('y'):
        open(CONFIG_FILENAME, 'w').write('http://%s:%s@%s/\n' % (
                options.username, options.password, options.server))


def config():
    usage = "usage: %prog [options] [filename] ..."
    parser = OptionParser(usage=usage)
    parser.add_option('-s', '--server', metavar='<hostname>',
        help="deploy to this server (default: read from .url file)")
    options, args = parser.parse_args()
    options.username = None
    options.password = None
    if os.path.exists(CONFIG_FILENAME):
        load_config(options)
    if not options.server:
        options.server = raw_input("Hostname: ")
    if not options.username:
        options.username = raw_input("Username: ")
    if not options.password:
        from getpass import getpass
        options.password = getpass("Password: ")
    return options, args


def upload_file(options, filename):
    urlpath = filename.replace('\\', '/')
    if urlpath.startswith('./'):
        urlpath = urlpath[2:]
    url = 'http://%s/%s' % (options.server, urlpath)
    data = open(filename).read()
    request = PutRequest(url, data)
    request.add_header('Cookie', 'sessionkey=' + options.session_key)
    print url
    print urllib2.urlopen(request).read()


def upload_dir(options, path):
    for dirpath, dirnames, filenames in os.walk(path):
        for dirname in dirnames:
            if dirname.startswith('.'):
                dirnames.remove(dirname)
        for filename in filenames:
            if filename.startswith('.'):
                continue
            if filename in IGNORE_FILENAMES:
                continue
            upload_file(options, dirpath + '/' + filename)


def main():
    options, args = config()
    if not os.path.exists(META_FILENAME):
        sys.exit('Could not find ' + META_FILENAME)
    options.session_key = login(options)
    if not args:
        args = ['.']
    for path in args:
        if os.path.isdir(path):
            upload_dir(options, path)
        elif os.path.isfile(path):
            upload_file(options, path)
    if not os.path.exists(CONFIG_FILENAME):
        save_config(options)


if __name__ == '__main__':
    try:
        main()
    except urllib2.HTTPError, e:
        print e
        for line in e.fp.readlines()[:140]:
            print line.rstrip()
