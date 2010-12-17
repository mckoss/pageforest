#!/usr/bin/env python

import re
import os
import hmac
import hashlib
import urllib
import urllib2
from datetime import datetime
from fnmatch import fnmatch
from optparse import OptionParser

# Swag at max content that can fit in a Blob
MAX_FILE_SIZE = 1024 * 1024 - 200

try:
    try:
        import json  # Python 2.6
    except ImportError:
        from django.utils import simplejson as json  # Django
except ImportError:
    import simplejson as json  # Please easy_install simplejson

SUBDOMAIN = 'admin'
META_FILENAME = 'app.json'
PASSWORD_FILENAME = '.passwd'
ERROR_FILENAME = 'pferror.html'
IGNORE_FILENAMES = ['pf.py', ERROR_FILENAME, '.*', '*~', '#*#',
                    '*.bak', '*.rej', '*.orig']
commands = None
APP_REGEX = re.compile(r'\s*"application":\s*\"([a-z0-9-]+)"')


def intcomma(value):
    orig = str(value)
    while True:
        new = re.sub("^(-?\d+)(\d{3})", '\g<1>,\g<2>', orig)
        if orig == new:
            return new
        orig = new


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
        self.add_header('Referer', 'http://%s.%s/' % (
                options.application, options.server))
        if (hasattr(options, 'session_key')):
            self.add_header('Cookie', 'sessionkey=' + options.session_key)


class PutRequest(AuthRequest):
    """Request to upload a file with HTTP PUT."""

    def get_method(self):
        return 'PUT'


class DeleteRequest(AuthRequest):
    """Request to remove a file with HTTP DELETE."""

    def get_method(self):
        return 'DELETE'


def hmac_sha1(key, message):
    return hmac.new(key, message, hashlib.sha1).hexdigest()


def sign_in():
    url = options.root_url + 'auth/challenge'
    if options.verbose:
        print "Getting %s" % url
    challenge = urllib2.urlopen(AuthRequest(url)).read()
    if options.verbose:
        print "Challenge: %s" % challenge
    userpass = hmac_sha1(options.password, options.username.lower())
    signature = hmac_sha1(userpass, challenge)
    reply = '|'.join((options.username, challenge, signature))
    url = options.root_url + 'auth/verify/' + reply
    if options.verbose:
        print "Response: %s" % url
    session_key = urllib2.urlopen(AuthRequest(url)).read()
    if options.verbose:
        print "Session key: %s" % session_key
    return session_key


def load_application():
    """
    Load application from META_FILENAME, or ask the user for it.
    """
    if options.application is not None:
        return

    if os.path.exists(META_FILENAME):
        parsed = json.loads(open(META_FILENAME, 'r').read())
    else:
        parsed = {}
    if 'application' in parsed:
        options.application = parsed['application']
        print "Application: " + options.application
    else:
        options.application = raw_input("Application: ")


def load_credentials():
    """
    Load username and password from base64-encoded .passwd file.
    """
    credentials = open(PASSWORD_FILENAME).readline().decode('base64')
    parts = credentials.split(':')
    if len(parts) == 2:
        return parts


def save_credentials():
    """
    Save username and password to base64-encoded .passwd file.
    """
    yesno = raw_input("Save password in %s file (Y/n)? " % PASSWORD_FILENAME)
    yesno = yesno.strip().lower() or 'y'
    if yesno.startswith('y'):
        credentials = '%s:%s' % (options.username, options.password)
        open(PASSWORD_FILENAME, 'w').write(credentials.encode('base64'))


def config():
    """
    Get configuration from command line, META_FILENAME and user input.
    """
    global options, commands

    commands = [function.split('_')[0] for function in globals()
                if function.endswith('_command')]
    commands.sort()
    usage = "usage: %prog [options] (" + '|'.join(commands) + ") [filenames]"
    parser = OptionParser(usage=usage)
    parser.add_option('-s', '--server', metavar='<hostname>',
        help="deploy to this server (default: pageforest.com")
    parser.add_option('-u', '--username')
    parser.add_option('-p', '--password')
    parser.add_option('-a', '--application')
    parser.add_option('-v', '--verbose', action='store_true')
    parser.add_option('-q', '--quiet', action='store_true')
    parser.add_option('-n', '--noop', action='store_true',
                      help="don't perform update operations")
    options, args = parser.parse_args()

    if not args:
        parser.error("No command specified.")
    options.command = args.pop(0).lower().strip()
    if not options.command:
        parser.error("Empty command.")
    # Prefix expansion.
    for command in commands:
        if command.startswith(options.command):
            options.command = command
    if options.command not in commands:
        parser.error("Unsupported command: " + options.command)

    if not options.server:
        options.server = "pageforest.com"

    if options.command == 'test':
        options.application = 'pfpytest'
    else:
        load_application()

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
    return args


def url_from_filename(filename):
    urlpath = filename.replace('\\', '/')
    if urlpath.startswith('./'):
        urlpath = urlpath[2:]
    url = options.root_url + urllib.quote(urlpath)
    return url


def upload_file(filename, url=None):
    """
    Upload one file to the server.
    """
    if url is None:
        url = url_from_filename(filename)
    data = open(filename, 'rb').read()
    if len(data) > MAX_FILE_SIZE:
        print "Skipping %s - file too large (%s bytes)." % \
              (filename, intcomma(len(data)))
        return
    keyname = filename.replace(os.path.sep, '/')
    # Check if the remote file is already up-to-date.
    if hasattr(options, 'listing') and keyname in options.listing:
        sha1 = hashlib.sha1(data).hexdigest()
        if filename == META_FILENAME:
            app = json.loads(data)
            if 'sha1' in app:
                sha1 = app['sha1']
        if options.listing[keyname]['sha1'] == sha1:
            if options.verbose:
                print "File hashes match: %s" % filename
            return
        elif options.verbose:
            print "Hash %s (file) != %s (server)." % (sha1, options.listing[keyname]['sha1'])
    # Upload file to Pageforest backend.
    or_not = options.noop and " (Not!)" or ""
    if not options.quiet:
        print "Uploading: %s (%s bytes)%s" % (url, intcomma(len(data)), or_not)
    if not options.noop:
        response = urllib2.urlopen(PutRequest(url), data)
        if options.verbose:
            print response.read()


def delete_file(filename, url=None):
    """
    Delete one file from the server.
    """
    if url is None:
        url = url_from_filename(filename)
    or_not = options.noop and " (Not!)" or ""
    if not options.quiet:
        print "Deleting: %s%s" % (url, or_not)
    if not options.noop:
        response = urllib2.urlopen(DeleteRequest(url))
        if options.verbose:
            print response.read()


def download_file(filename, url=None):
    """
    Download a file from the server.
    """
    if url is None:
        url = url_from_filename(filename)
    # Check if the local file is already up-to-date.
    info = {}
    if hasattr(options, 'listing') and filename in options.listing:
        info = options.listing[filename]
        if info['sha1'] == sha1_file(filename):
            if options.verbose:
                print "File hashes match: %s" % filename
            return
    # Download file from Pageforest backend.
    or_not = options.noop and " (Not!)" or ""
    if not options.quiet:
        if 'size' in info:
            print "Downloading: %s (%s bytes)%s" % (url, intcomma(info['size']), or_not)
        else:
            print "Downloading: %s%s" % (url, or_not)
    if not options.noop:
        response = urllib2.urlopen(AuthRequest(url))
        outfile = open(filename, 'wb')
        outfile.write(response.read())
        outfile.close()


def prefix_match(args, filename):
    """
    Check if the filename starts with one of the prefixes.
    """
    for arg in args:
        if filename.startswith(arg):
            return True


def pattern_match(patterns, filename):
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
            if pattern_match(IGNORE_FILENAMES, filename):
                continue
            upload_file(os.path.join(dirpath, filename))


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


def list_remote_files():
    """
    Get the list of files on the remote server, with metadata.
    """
    url = options.root_url + '?method=list&depth=0'
    options.listing = {}
    try:
        cursor_param = ""
        while True:
            response = urllib2.urlopen(AuthRequest(url + cursor_param))
            result = json.loads(response.read(), object_hook=as_datetime)
            # Change result of list command on 12/8/10
            if 'items' in result:
                # Changed items from dict to array on 12/16/10!
                if type(result['items']) == list:
                    item_dict = {}
                    for item in result['items']:
                        item_dict[item['key']] = item
                    result['items'] = item_dict

                options.listing.update(result['items'])
                if 'cursor' not in result:
                    break
                cursor_param = "&cursor=%s" % result['cursor']
                if options.verbose:
                    print "Paging: %s" % cursor_param
            else:
                options.listing = result
                break
    except urllib2.HTTPError, e:
        print "Error listing files: %s: %s" % (unicode(e), e.read())
        # For newly created apps - listing will return error.
        # Treat as empty on the server.
        options.listing = {}


def get_command(args):
    """
    Download all files for an app, except files that are already
    up-to-date (same SHA-1 hash as remote).
    """
    list_remote_files()
    download_file(META_FILENAME)
    filenames = options.listing.keys()
    filenames.sort()
    for filename in filenames:
        if filename == META_FILENAME:
            continue
        if args and not prefix_match(args, filename):
            continue
        # Make directory if needed.
        dirname = os.path.dirname(filename)
        if dirname and not os.path.exists(dirname):
            if options.verbose:
                print "Making directory: %s" % dirname
            os.makedirs(dirname)
        # Download file from Pageforest backend server.
        download_file(filename)


def put_command(args):
    """
    Upload all files for an app, except files that are already
    up-to-date (same SHA-1 hash as remote).
    """
    list_remote_files()
    if not args:
        args = [name for name in os.listdir('.')
                if not name.startswith('.')
                and not pattern_match(IGNORE_FILENAMES, name)]
    # REVIEW: The following doesn't work if you use "pf put <folder>"
    # to upload some files including META_FILENAME inside <folder>.
    # Should we require that "pf put" is always run in the same folder
    # where META_FILENAME lives?
    if META_FILENAME in args:
        upload_file(META_FILENAME)
        args.remove(META_FILENAME)
    if not args:
        return
    for path in args:
        if os.path.isdir(path):
            upload_dir(path)
        elif os.path.isfile(path):
            upload_file(path)


def delete_command(args):
    """
    Download all files for an app, except files that are already
    up-to-date (same SHA-1 hash as remote).
    """
    list_remote_files()
    download_file(META_FILENAME)
    filenames = options.listing.keys()
    filenames.sort()
    for filename in filenames:
        if args and not prefix_match(args, filename):
            continue
        delete_file(filename)


def vacuum_command(args):
    """
    List remote files that no longer exist locally, then delete them
    (after prompting the user).
    """
    list_remote_files()
    filenames = options.listing.keys()
    filenames.sort()
    selected = []
    for filename in filenames:
        if args and not prefix_match(args, filename):
            continue
        if os.path.isfile(filename):
            continue
        print_file_info(filename, options.listing[filename])
        selected.append(filename)
    if not selected:
        print "No files to vacuum."
        return
    answer = raw_input(
        "Are you sure you want to DELETE %s remote files? " %
        intcomma(len(selected)))
    if answer.lower().startswith('y'):
        for filename in selected:
            delete_file(filename)


def print_file_info(filename, metadata):
    print '%s  %s  %s\t(%s bytes)' % (
        metadata['sha1'],
        metadata['modified'].strftime('%Y-%m-%d %H:%M:%S'),
        filename,
        intcomma(metadata['size']))


def list_command(args):
    """
    Show SHA-1 hash and filename for remote files. If args specified,
    only show files that start with one of args.
    """
    list_remote_files()
    filenames = options.listing.keys()
    filenames.sort()
    count = 0
    size = 0
    for filename in filenames:
        if args and not prefix_match(args, filename):
            continue
        print_file_info(filename, options.listing[filename])
        count += 1
        size += options.listing[filename]['size']
    print "%s files: %s Total bytes" % (intcomma(count), intcomma(size))


def sha1_command(args):
    """
    Print the SHA-1 hash of each argument.
    """
    if not args:
        args = os.listdir('.')
    for path in args:
        if os.path.isdir(path):
            sha1_command([os.path.join(path, filename)
                          for filename in os.listdir(path)])
        if os.path.isfile(path):
            infile = open(path, 'rb')
            data = infile.read()
            infile.close()
            print '%s  %s' % (hashlib.sha1(data).hexdigest(), path)


def test_command(args):
    """
    Test all commands against a live server.
    """
    # Create temp folder.
    dirname = options.application
    if not os.path.exists(dirname):
        os.mkdir(dirname)
    os.chdir(dirname)
    # Create META_FILENAME with metadata.
    outfile = open(META_FILENAME, 'w')
    outfile.write('{"application": "%s"}' % options.application)
    outfile.close()
    # Create test.txt with current timestamp as content.
    write_data = datetime.now().isoformat()
    filename = 'test.txt'
    outfile = open(filename, 'w')
    outfile.write(write_data)
    outfile.close()
    # Show local SHA-1 hashes.
    sha1_command(['test.txt'])
    # Upload everything, then delete local files.
    put_command([])
    os.unlink(META_FILENAME)
    os.unlink(filename)
    # Show remote SHA-1 hashes.
    list_command([])
    # Download everything, then verify file content.
    get_command([])
    infile = open(filename, 'r')
    read_data = infile.read()
    infile.close()
    assert read_data == write_data
    # Verify META_FILENAME content.
    infile = open(META_FILENAME, 'r')
    app_json = infile.read()
    infile.close()
    assert '"modified":' in app_json
    assert '"tags": []' in app_json
    # Clean up.
    os.unlink(META_FILENAME)
    os.unlink(filename)
    os.chdir('..')
    os.rmdir(dirname)


def main():
    args = config()
    options.root_url = 'http://%s.%s.%s/' % (
        SUBDOMAIN, options.application, options.server)
    options.session_key = sign_in()
    globals()[options.command + '_command'](args)
    if options.save:
        save_credentials()


if __name__ == '__main__':
    try:
        main()
    except urllib2.HTTPError, e:
        result = e.read()
        try:
            json_response = json.loads(result)
            if 'textStatus' in json_response:
                print "Error: %s" % json_response['textStatus']
            else:
                print json_response
        except:
            print "%s: %s - see pferror.html for details." % (e, e.url)
            error_file = open(ERROR_FILENAME, 'wb')
            error_file.write(result + '\n')
            error_file.close()

        exit(1)
