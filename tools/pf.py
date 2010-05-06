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
IGNORE_FILENAMES = []
COMMANDS = ['get', 'put']


class PutRequest(urllib2.Request):
    """Request to upload a file with HTTP PUT."""

    def get_method(self):
        return 'PUT'


def hmac_sha1(key, message):
    return hmac.new(key, message, hashlib.sha1).hexdigest()


def login(options):
    url = 'http://%s/auth/challenge' % options.server
    challenge = urllib2.urlopen(url).read()
    print("Challenge: %s" % challenge)
    userpass = hmac_sha1(options.password, options.username.lower())
    signature = hmac_sha1(userpass, challenge)
    reply = '/'.join((options.username, challenge, signature))
    url = 'http://%s/auth/verify/%s' % (options.server, reply)
    print("Response: %s" % url)
    session_key = urllib2.urlopen(url).read()
    print("Session key: %s" % session_key)
    return session_key


def load_config(options):
    hostname = username = password = ''
    parts = open(CONFIG_FILENAME).readline().split('/')
    if len(parts) > 2 and parts[0] == 'http:' and parts[1] == '':
        hostname = parts[2]
    if '@' in hostname:
        username, hostname = hostname.split('@', 1)
    if ':' in username:
        username, password = username.split(':', 1)
    options.server = hostname
    if not options.password and not options.username:
        options.password = password
    if not options.username:
        options.username = username


def save_config(options):
    yesno = raw_input("Save %s file (Y/n)? " % CONFIG_FILENAME) or 'y'
    if yesno.lower().startswith('y'):
        open(CONFIG_FILENAME, 'w').write('http://%s:%s@%s/\n' % (
                options.username, options.password, options.server))


def config():
    usage = "usage: %prog [options] (" + '|'.join(COMMANDS) + ") [filenames]"
    parser = OptionParser(usage=usage)
    parser.add_option('-s', '--server', metavar='<hostname>',
        help="deploy to this server (default: read from .url file)")
    parser.add_option('-u', '--username')
    parser.add_option('-p', '--password')
    options, args = parser.parse_args()

    if not args:
        parser.error("No command specified.")
    options.command = args.pop(0).lower().strip()
    if not options.command:
        parser.error("Empty command.")
    # Prefix expansion.
    for command in COMMANDS:
        if command.startswith(options.command):
            options.command = command
    if options.command not in COMMANDS:
        parser.error("Unsupported command: " + options.command)

    if not args:
        args = ['.']

    if os.path.exists(CONFIG_FILENAME) and not options.server:
        load_config(options)

    options.save = False
    if not options.server:
        options.server = raw_input("Hostname: ")
        options.save = True
    if not options.username:
        options.username = raw_input("Username: ")
        options.save = True
    if not options.password:
        from getpass import getpass
        options.password = getpass("Password: ")
        options.save = True
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


def get(options, args):
    raise NotImplementedError


def put(options, args):
    for path in args:
        if os.path.isdir(path):
            upload_dir(options, path)
        elif os.path.isfile(path):
            upload_file(options, path)


def main():
    options, args = config()
    options.session_key = login(options)
    globals()[options.command](options, args)
    if options.save:
        save_config(options)


if __name__ == '__main__':
    try:
        main()
    except urllib2.HTTPError, e:
        print e
        for line in e.fp.readlines()[:140]:
            print line.rstrip()
