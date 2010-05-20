#!/usr/bin/env python

import re
import os
import sys
import hmac
import hashlib
import urllib2
from datetime import datetime
from fnmatch import fnmatch
from optparse import OptionParser

try:
    try:
        import json  # Python 2.6
    except ImportError:
        from django.utils import simplejson as json  # Django
except ImportError:
    import simplejson as json  # Please easy_install simplejson

META_FILENAME = 'app.json'
PASSWORD_FILENAME = '.passwd'
IGNORE_FILENAMES = ['pf.py', '.*', '*~', '*.bak', '*.rej', '*.orig']
COMMANDS = ['get', 'put']  # TODO: Add list and delete.
APP_REGEX = re.compile(r'\s*"application":\s*\"([a-z0-9-]+)"')


def as_datetime(dct):
    """Decode datetime objects from JSON dictionary."""
    if dct.get('__class__', '') == 'Date' and 'isoformat' in dct:
        isoformat = dct['isoformat'][:19]
        return datetime.strptime(isoformat, '%Y-%m-%dT%H:%M:%S')
    return dct


class AuthRequest(urllib2.Request):
    """HTTP request with sessionkey cookie and referer."""

    def __init__(self, url, *args, **kwargs):
        urllib2.Request.__init__(self, url, *args, **kwargs)
        self.add_header('Referer', url)
        self.add_header('Cookie', 'sessionkey=' + options.session_key)


class PutRequest(AuthRequest):
    """Request to upload a file with HTTP PUT."""

    def get_method(self):
        return 'PUT'


def hmac_sha1(key, message):
    return hmac.new(key, message, hashlib.sha1).hexdigest()


def login(server):
    appid = options.application
    url = 'http://%s/auth/challenge' % server
    if options.verbose:
        print("Getting %s" % url)
    challenge = urllib2.urlopen(url).read()
    if options.verbose:
        print("Challenge: %s" % challenge)
    userpass = hmac_sha1(options.password, options.username.lower())
    signature = hmac_sha1(userpass, challenge)
    reply = '/'.join((options.username, challenge, signature))
    url = 'http://%s/auth/verify/%s' % (server, reply)
    if options.verbose:
        print("Response: %s" % url)
    session_key = urllib2.urlopen(url).read()
    if options.verbose:
        print("Session key: %s" % session_key)
    return session_key


def load_application():
    for line in file(META_FILENAME):
        match = APP_REGEX.match(line)
        if match:
            return match.group(1)


def load_credentials():
    credentials = open(PASSWORD_FILENAME).readline().decode('base64')
    parts = credentials.split(':')
    if len(parts) == 2:
        return parts


def save_credentials():
    yesno = raw_input("Save password in %s file (Y/n)? " % PASSWORD_FILENAME)
    yesno = yesno.strip().lower() or 'y'
    if yesno.startswith('y'):
        credentials = '%s:%s' % (options.username, options.password)
        open(PASSWORD_FILENAME, 'w').write(credentials.encode('base64'))


def config():
    usage = "usage: %prog [options] (" + '|'.join(COMMANDS) + ") [filenames]"
    parser = OptionParser(usage=usage)
    parser.add_option('-s', '--server', metavar='<hostname>',
        help="deploy to this server (default: pageforest.com")
    parser.add_option('-u', '--username')
    parser.add_option('-p', '--password')
    parser.add_option('-v', '--verbose', action='store_true')
    parser.add_option('-q', '--quiet', action='store_true')
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

    if options.verbose:
        print("Found simplejson in %s" % os.path.dirname(json.__file__))

    if not options.server:
        options.server = "pageforest.com"

    options.application = load_application()
    if not options.application:
        parser.error('Missing "application" key in app.json.')
    if options.verbose:
        print("Application: %s" % options.application)

    if os.path.exists(PASSWORD_FILENAME):
        options.username, options.password = load_credentials()

    options.save = False
    if not options.username:
        options.username = raw_input("Username: ")
        options.save = True
    if not options.password:
        from getpass import getpass
        options.password = getpass("Password: ")
        options.save = True
    return options, args


def upload_file(filename, url=None):
    """
    Upload one file to the server.
    """
    if url is None:
        urlpath = filename.replace('\\', '/')
        if urlpath.startswith('./'):
            urlpath = urlpath[2:]
        url = 'http://%s.%s/%s' % (
            options.application, options.server, urlpath)
    data = open(filename, 'rb').read()
    if not options.quiet:
        print("Uploading: %s (%d bytes)" % (url, len(data)))
    response = urllib2.urlopen(PutRequest(url, data))
    if options.verbose:
        print(response.read())


def upload_meta_file():
    """
    Upload app.json to www.pageforest.com (or www.<server>)
    """
    app_id = options.application
    options.session_key = login('www.' + options.server)
    url = 'http://www.%s/apps/%s/app.json' % (options.server, app_id)
    upload_file(META_FILENAME, url)


def filename_matches(filename, patterns):
    """
    Check if the filename matches any of the patterns.
    """
    for pattern in patterns:
        if fnmatch(filename, pattern):
            return True


def upload_dir(path):
    """
    Upload a directory, including all files and subdirectories.
    """
    for dirpath, dirnames, filenames in os.walk(path):
        for dirname in dirnames:
            if dirname.startswith('.'):
                dirnames.remove(dirname)
        for filename in filenames:
            if filename_matches(filename, IGNORE_FILENAMES):
                continue
            upload_file(dirpath + '/' + filename)


def sha1_file(filename):
    """
    Hash the contents of a file with SHA-1.
    Return the hexdigest, or None if file not found.
    """
    if not os.path.exists(filename):
        return None
    infile = open(filename, 'rb')
    content = infile.read()
    infile.close()
    return hashlib.sha1(content).hexdigest()


def get(args):
    """
    Download all files for an app, except files that are already
    up-to-date (same SHA-1 hash as remote).
    """
    options.session_key = login(options.application + '.' + options.server)
    url = 'http://%s.%s/?method=list' % (options.application, options.server)
    response = urllib2.urlopen(url)
    listing = json.loads(response.read(), object_hook=as_datetime)
    filenames = listing.keys()
    filenames.sort()
    for filename in filenames:
        info = listing[filename]
        # Check if the file is already up-to-date.
        if info['sha1'] == sha1_file(filename):
            if options.verbose:
                print("Already up-to-date: %s" % filename)
            continue
        # Make directory if needed.
        dirname = os.path.dirname(filename)
        if dirname and not os.path.exists(dirname):
            if options.verbose:
                print("Making directory: %s" % dirname)
            os.makedirs(dirname)
        # Download file from Pageforest backend server.
        url = 'http://%s.%s/%s' % (
            options.application, options.server, filename)
        print("Downloading: %s (%d bytes)" % (url, info['size']))
        response = urllib2.urlopen(AuthRequest(url))
        outfile = open(filename, 'wb')
        outfile.write(response.read())
        outfile.close()


def put(args):
    if not args:
        args = [name for name in os.listdir('.')
                if not name.startswith('.')
                and not filename_matches(name, IGNORE_FILENAMES)]
    # REVIEW: The following doesn't work if you use "pf put <folder>"
    # to upload some files including META_FILENAME inside <folder>.
    # Should we require that "pf put" is always run in the same folder
    # where META_FILENAME lives?
    if META_FILENAME in args:
        upload_meta_file()
        args.remove(META_FILENAME)
    if not args:
        return
    options.session_key = login(options.application + '.' + options.server)
    for path in args:
        if os.path.isdir(path):
            upload_dir(path)
        elif os.path.isfile(path):
            upload_file(path)


def main():
    global options
    options, args = config()
    globals()[options.command](args)
    if options.save:
        save_credentials()


if __name__ == '__main__':
    try:
        main()
    except urllib2.HTTPError, e:
        print("%s: %s" % (e, e.url))
        for line in e.fp.readlines()[:140]:
            print(line.rstrip())
