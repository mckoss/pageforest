#!/usr/bin/env python
"""
pf.py - Pageforest Application Uploader

See http://pageforest.com for more information about the
Pageforest web application platform.

This utliity will deploy files to your pageforest application
so you can edit your application files on your local machine.

See pf.py --help for more information.
"""

import re
import os
import hmac
import hashlib
import urllib
import urllib2
from base64 import b64encode
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

ADMIN = 'admin'
META_FILENAME = 'app.json'
MANIFEST_FILENAME = 'app.manifest'
AUTOGEN_LINE = "# AUTOGENERATED"
AUTOGEN_EXPLAIN = "# All contents below AUTOGENERATED are managed by pf.py" \
    "\n# Directives starting with '#!' will be preserved."
OPTIONS_FILENAME = '.pf'
DOC_ID_REGEX = r"[a-zA-Z0-9_-][a-zA-Z0-9\._-]{,99}"
ERROR_FILENAME = 'pferror.html'
IGNORE_FILENAMES = ('pf.py', OPTIONS_FILENAME, ERROR_FILENAME, '.*', '*~', '#*#',
                    '*.bak', '*.rej', '*.orig')
LOCAL_COMMANDS = ['dir', 'offline']

commands = None


def intcomma(value):
    if value is None:
        return "---"

    orig = str(value)
    while True:
        new = re.sub("^(-?\d+)(\d{3})", '\g<1>,\g<2>', orig)
        if orig == new:
            return new
        orig = new


def project(d, keys):
    """
    Return a dictionary that is the projection of properties
    from the keys list.

    >>> project({}, ['a'])
    {}
    >>> project({'a': 1, 'b': 2}, ['a'])
    {'a': 1}
    >>> project({'a': 1, 'b': 2}, ['b', 'c'])
    {'b': 2}
    """
    result = {}
    for key in keys:
        if key in d:
            result[key] = d[key]
    return result


def as_datetime(dct):
    """
    Decode datetime objects from JSON dictionary.
    """
    if dct.get('__class__', '') == 'Date' and 'isoformat' in dct:
        isoformat = dct['isoformat'][:19]
        return datetime.strptime(isoformat, '%Y-%m-%dT%H:%M:%S')
    return dct


class ModelEncoder(json.JSONEncoder):
    """
    Encode Date objects to JSON.
    """
    def default(self, obj):
        if isinstance(obj, datetime):
            return {"__class__": "Date",
                    "isoformat": obj.isoformat() + 'Z'}
        return json.JSONEncoder.default(self, obj)


class AuthRequest(urllib2.Request):
    """HTTP request with sessionkey cookie and referer."""

    def __init__(self, url, *args, **kwargs):
        urllib2.Request.__init__(self, url, *args, **kwargs)
        self.add_header('Referer', 'http://%s.%s/' % (
                options.application, options.server))
        if (hasattr(options, 'session_key')):
            self.add_header('Cookie', 'sessionkey=' + options.session_key)
        if options.verbose:
            print "HTTP %s %s" % (self.get_method(), url)


class PutRequest(AuthRequest):
    """Request to upload a file with HTTP PUT."""

    def get_method(self):
        return 'PUT'


class DeleteRequest(AuthRequest):
    """Request to remove a file with HTTP DELETE."""

    def get_method(self):
        return 'DELETE'


def hmac_sha1(key, message):
    # Convert unicode strings to byte strings - hmac will throw type error
    key = str(key)
    message = str(message)
    return hmac.new(key, message, hashlib.sha1).hexdigest()


def sign_in():
    url = options.root_url + 'auth/challenge'
    challenge = urllib2.urlopen(AuthRequest(url)).read()
    if options.verbose:
        print "Challenge: %s" % challenge
    signature = hmac_sha1(options.secret, challenge)
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
    if options.local_only:
        return

    if options.command == 'listapps':
        options.application = 'www'
        options.save_app = False
        options.root_url = 'http://www.%s/' % options.server

    if options.application is None:
        if os.path.exists(META_FILENAME):
            parsed = json.loads(open(META_FILENAME, 'r').read())
        else:
            parsed = {}
        if 'application' in parsed:
            options.application = parsed['application']
            options.save_app = False
        else:
            options.application = raw_input("Application: ")

    if options.docs:
        options.root_url = 'http://%s.%s/' % (options.application, options.server)

    if not hasattr(options, 'root_url'):
        options.root_url = 'http://%s.%s.%s/' % (ADMIN, options.application, options.server)

    print "Server: %s" % options.root_url


def load_options():
    """
    Load saved options from options file.   Don't override command line
    provided options.
    """
    options.local_only = options.command in LOCAL_COMMANDS
    options.save_app = True

    options.secret = None
    file_options = {}
    if os.path.exists(OPTIONS_FILENAME):
        file_options = json.loads(open(OPTIONS_FILENAME, 'r').read())

    for prop in ('files', 'secret', 'server', 'username', 'application'):
        if getattr(options, prop, None) is None:
            setattr(options, prop, file_options.get(prop))

    if not options.server:
        options.server = "pageforest.com"

    if not options.files:
        options.files = {}

    if not options.local_only:
        if not options.username:
            options.username = raw_input("Username: ")
        if not options.secret:
            if not options.password:
                from getpass import getpass
                options.password = getpass("Password: ")
            options.secret = hmac_sha1(options.password, options.username.lower())


def save_options():
    """
    Save options in options file for later use.
    """
    file_options = {}
    for prop in ['username', 'secret', 'server']:
        file_options[prop] = getattr(options, prop)

    if options.save_app:
        file_options['application'] = options.application

    if hasattr(options, 'local_listing'):
        files = {}
        for path in options.local_listing:
            files[path] = project(options.local_listing[path], ['time', 'size', 'sha1'])
        file_options['files'] = files
    else:
        file_options['files'] = options.files

    open(OPTIONS_FILENAME, 'w').write(to_json(file_options))


def config():
    """
    Get configuration from command line, META_FILENAME and user input.
    """
    global options, commands

    commands = [function.split('_')[0] for function in globals()
                if function.endswith('_command')]
    commands.sort()
    usage = "usage: %prog [options] (" + '|'.join(commands) + ") [filenames]"
    for command in commands:
        usage += "\n%s: %s" % (command, globals()[command + '_command'].__doc__)

    parser = OptionParser(usage=usage)
    parser.add_option('-s', '--server', metavar='<hostname>',
        help="deploy to this server (default: pageforest.com")
    parser.add_option('-u', '--username')
    parser.add_option('-p', '--password')
    parser.add_option('-a', '--application')
    parser.add_option('-d', '--docs', action='store_true')
    parser.add_option('-v', '--verbose', action='store_true')
    parser.add_option('-q', '--quiet', action='store_true')
    parser.add_option('-r', '--raw', action='store_true',
                      help="Default is to upload all files using base64 encoding.  "
                      "This option overrides and sends raw binary files.")
    parser.add_option('-f', '--force', action='store_true',
                      help="Ignore sha1 hashes and get/put all files.")
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
            break
    if options.command not in commands:
        parser.error("Unsupported command: " + options.command)

    return args


def url_from_path(path):
    return options.root_url + urllib.quote(path)


def should_encode(filename):
    """
    Some versions of python have problems with raw binary PUT's - treating data
    as ascii and complaining.  So, use base64 transfer encoding.
    """
    if options.raw or filename == META_FILENAME or is_doc_path(filename):
        return False
    return True


def upload_file(filename):
    """
    Upload one file to the server.
    """
    url = url_from_path(filename)

    local_info = options.local_listing[filename]
    if local_info['size'] > MAX_FILE_SIZE:
        print "Skipping %s - file too large (%s bytes)." % \
              (filename, intcomma(local_info['size']))
        return

    # Compare if remote file has same hash as local one
    if filename in options.listing:
        info = options.listing[filename]
        is_equal = info['sha1'] == local_info['sha1']
        if options.verbose:
            print "SHA1 %s (local) %s %s (server) for %s" % \
                (local_info['sha1'],
                 is_equal and "==" or "!=",
                 info['sha1'],
                 filename)
        if not options.force and is_equal:
            return
    elif options.verbose:
        print "Could not find %s on server." % filename

    file = open(get_local_path(filename), 'rb')
    data = file.read()
    file.close()

    or_not = options.noop and " (Not!)" or ""
    if not options.quiet:
        print "Uploading: %s (%s bytes)%s" % (url, intcomma(len(data)), or_not)

    if options.noop:
        return

    if should_encode(filename):
        data = b64encode(data)
        url += '?transfer-encoding=base64'
    response = urllib2.urlopen(PutRequest(url), data)
    if options.verbose:
        print "Response: %s" % response.read()


def delete_file(filename):
    """
    Delete one file from the server.
    """
    url = url_from_path(filename)
    or_not = options.noop and " (Not!)" or ""
    if not options.quiet:
        print "Deleting: %s%s" % (url, or_not)
    if options.noop:
        return

    response = urllib2.urlopen(DeleteRequest(url))
    if options.verbose:
        print "Response: %s" % response.read()


def download_file(filename):
    """
    Download a file from the server.

    Convert blob paths to be: docs/docid_blobs/blob_path
    """
    url = url_from_path(filename)

    # Check if the local file is already up-to-date.
    if not options.force:
        info = options.listing[filename]
        local_info = options.local_listing.get(filename, {"sha1": "no-local-file"})
        is_equal = info['sha1'] == local_info['sha1']
        if options.verbose:
            print "SHA1 %s (local) %s %s (server) for %s" % \
                (local_info['sha1'],
                 is_equal and "==" or "!=",
                 info['sha1'],
                 filename)
        if is_equal:
            return

    # Download file from Pageforest backend.
    or_not = options.noop and " (Not!)" or ""
    if not options.quiet:
        print "Downloading: %s (%s bytes)%s" % (url, intcomma(info['size']), or_not)

    if options.noop:
        return

    response = urllib2.urlopen(AuthRequest(url))
    filename = get_local_path(filename)
    # Make directory if needed.
    dirname = os.path.dirname(filename)
    if dirname:
        if os.path.exists(dirname) and not os.path.isdir(dirname):
            print "Converting %s to %s (directory name conflict)" % (dirname, dirname + '.blob')
            os.rename(dirname, dirname + '.blob')
        if not os.path.exists(dirname):
            if options.verbose:
                print "Making directory: %s" % dirname
            os.makedirs(dirname)

    try:
        outfile = open(filename, 'wb')
        outfile.write(response.read())
        outfile.close()
    except IOError, e:
        print "Could not write file, %s (%s)." % (filename, e.strerror)


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


def to_json(d, extra=None, include=None, exclude=None, indent=2):
    """
    Serialize an object to json.
    """
    assert isinstance(d, dict)
    if exclude is None:
        exclude = ()
    result = {}
    for name in d:
        if exclude and name in exclude:
            continue
        if include and name not in include:
            continue
        result[name] = d[name]
    if extra:
        result.update(extra)
    if indent is None:
        return json.dumps(result, sort_keys=True,
                          separators=(',', ':'), cls=ModelEncoder)
    else:
        return json.dumps(result, sort_keys=True, cls=ModelEncoder,
                          indent=indent, separators=(',', ': ')) + '\n'


def is_data_path(filename):
    return filename.startswith('docs')


def is_doc_path(filename):
    return is_data_path(filename) and filename.count('/') == 1


def get_local_path(path):
    """
    Paths are keys in the Pageforest store.  There is no retriction
    on paths being prefixes of other paths (unlike the filesytem, where
    a file path to a *file* cannot be a sufix of another file path - only
    *directories* can have prefix paths.
    """
    if os.path.isdir(path):
        return path + '.blob'

    return path


def normalize_local_path(path):
    """
    Inverse of get_local_path.
    """
    if path.endswith('.blob'):
        return path[:-5]

    return path


def sha1_file(filename, data=None):
    """
    Hash the contents of the file using SHA-1.
    """
    if not os.path.exists(filename):
        return None
    if data is None:
        if options.verbose:
            print "Reading file for SHA1: %s" % filename
        infile = open(filename, 'rb')
        data = infile.read()
        infile.close()
    # Normalize document for sha1 computation.
    if filename == META_FILENAME or is_doc_path(filename):
        try:
            app = json.loads(data)
            data = to_json(app, exclude=('sha1', 'size', 'modified',
                                         'created', 'application', 'docid'))
        except ValueError, e:
            print "Invalid document format in file %s - not JSON" % filename
            return None
    sha1 = hashlib.sha1(data).hexdigest()
    return sha1


def list_remote_path(path):
    url = "%s%s?method=list&depth=0" % (options.root_url, path)
    cursor_param = ""
    count = 0
    while True:
        response = urllib2.urlopen(AuthRequest(url + cursor_param))
        result = response.read()
        result = json.loads(result, object_hook=as_datetime)
        files = result['items']
        count += len(files)
        if path != '':
            path_files = {}
            for filename, info in files.items():
                path_files[path + filename] = info
            files = path_files
        options.listing.update(files)
        if options.verbose and count:
            print "%s files" % intcomma(count)
        if 'cursor' not in result:
            break
        cursor_param = "&cursor=%s" % result['cursor']


def list_remote_files():
    """
    Get the list of files on the remote server, with metadata.
    """
    options.listing = {}
    try:
        list_remote_path(options.docs and 'docs/' or '')
    except urllib2.HTTPError, e:
        # For newly created apps - listing will return error.
        # Treat as empty on the server.
        options.listing = {}
        return

    if not options.docs:
        return

    # Check for child blobs under each document
    docnames = options.listing.keys()
    docnames.sort()
    for docname in docnames:
        list_remote_path(docname + '/')


def update_local_listing(local_path):
    """
    Update the options.local_listing[path] to the latest information.  Uses
    the options.files cache if the file has not been more recently modified.

    Local listing paths are stored normalized to be the corresponding server-side
    (relative) path from the root of the application domain.

    REVIEW: We don't allow for any blob key to be a prefix of any other
    (i.e, a blob can't be both a directory and a file).
    """
    path = normalize_local_path(local_path)

    if path in options.files and \
        options.files[path]['time'] == int(os.path.getmtime(local_path)):
        options.local_listing[path] = options.files[path]
    else:
        options.local_listing[path] = {
            'sha1': sha1_file(local_path),
            'time': int(os.path.getmtime(local_path)),
            'size': os.path.getsize(local_path)
            }
    options.local_listing[path]['modified'] = \
        datetime.fromtimestamp(os.path.getmtime(local_path))


def list_local_files():
    """
    Get the list of all local files, with metadata is same format as remote file
    listing.
    """
    options.local_listing = {}
    for dirpath, dirnames, filenames in os.walk('.'):
        for dirname in dirnames:
            if dirname.startswith('.'):
                dirnames.remove(dirname)
        for filename in filenames:
            if pattern_match(IGNORE_FILENAMES, filename):
                continue
            path = os.path.relpath(os.path.join(dirpath, filename))
            update_local_listing(path)


def check_args(args):
    """
    Make sure file prefix args match options.docs.  We don't
    do both document and app file uploading in one pass.
    """
    for arg in args:
        if options.docs and not is_data_path(arg):
            print "%s is not a document.  Conflicts with -d option." % arg
            exit(1)
        if not options.docs and is_data_path(arg):
            print "%s is a document - you must use the -d option." % arg
            exit(1)


def get_command(args):
    """
    Download all files for an app, except files that are already
    up-to-date (same SHA-1 hash as remote).
    """
    list_remote_files()
    list_local_files()
    filenames = options.listing.keys()
    filenames.sort()
    for filename in filenames:
        if args and not prefix_match(args, filename):
            continue
        download_file(filename)


def put_command(args):
    """
    Upload all files for an app, except files that are already
    up-to-date (same SHA-1 hash as remote).
    """
    list_remote_files()
    list_local_files()
    update_manifest()

    # Ensure that application is created before uploading other application files
    if not options.docs:
        upload_file(META_FILENAME)

    paths = options.local_listing.keys()
    paths.sort()
    for path in paths:
        if path == META_FILENAME:
            continue
        if (not options.docs) is is_data_path(path):
            continue
        if args and not prefix_match(args, path):
            continue
        upload_file(path)


def delete_command(args):
    """
    Delete files from the server (leaves local files alone).

    If no filename is given, the entire app is deleted.
    """
    if not args:
        if if_yes("Are you sure you want to DELETE %s and all it's files from %s" %
                  (options.application, options.server)):
            delete_file(META_FILENAME)
        return

    list_remote_files()
    filenames = options.listing.keys()

    selected = []
    for filename in filenames:
        if args and not prefix_match(args, filename):
            continue
        selected.append(filename)

    delete_files(selected)


def if_yes(prompt):
    answer = raw_input("%s (yes/no)? " % prompt)
    f = answer.lower().startswith('y')
    if not f:
        print "I'll take that as a no."
    return f


def delete_files(filenames):
    if META_FILENAME in filenames:
        filenames.remove(META_FILENAME)

    if not filenames:
        print "No files to delete."
        return

    filenames.sort()

    if not options.noop:
        for filename in filenames:
            print_file_info(filename, options.listing[filename])

        if not if_yes("Are you sure you want to DELETE %s files from %s" %
                      (intcomma(len(filenames)), options.server)):
            return

    for filename in filenames:
        delete_file(filename)


def vacuum_command(args):
    """
    List remote files that no longer exist locally, then delete them.
    """
    list_remote_files()
    list_local_files()
    filenames = options.listing.keys()
    selected = []
    for filename in filenames:
        if args and not prefix_match(args, filename):
            continue
        if filename in options.local_listing:
            continue
        print_file_info(filename, options.listing[filename])
        selected.append(filename)

    delete_files(selected)


def update_manifest(explicit=False):
    """
    Update the manifest file AUTOGENERATED secion.  We do this on
    each application upload in case any files have changed that
    require a new manifest file be written.
    """
    if not os.path.exists(MANIFEST_FILENAME):
        return

    manifest_file = open(MANIFEST_FILENAME, 'r')
    parts = manifest_file.read().partition('\n' + AUTOGEN_LINE)
    manifest_file.close()
    if parts[1] == '':
        if explicit:
            print "%s has no AUTOGENERATE section" % MANIFEST_FILENAME
        return

    commands = [line for line in parts[2].split('\n') if line.startswith('#!')]
    excludes = []
    for command in commands:
        match = re.match(r'#!\s*EXCLUDE:\s*(.*)\s*$', command)
        if match:
            excludes.extend(re.split(r",\s*", match.group(1)))

    cached_files = []
    hash_lines = []

    paths = options.local_listing.keys()
    paths.sort()
    size = 0
    for path in paths:
        info = options.local_listing[path]
        if path == MANIFEST_FILENAME or path == META_FILENAME or \
            info['size'] > MAX_FILE_SIZE or \
            is_data_path(path) or \
            prefix_match(excludes, path):
            continue
        cached_files.append(path)
        hash_lines.append("%s=%s" % (path, info['sha1']))
        size += info['size']

    manifest_lines = [parts[0], AUTOGEN_LINE, AUTOGEN_EXPLAIN]
    manifest_lines.extend(commands)
    manifest_lines.extend((
            "# TOTAL FILES: %s (%s bytes)" % (intcomma(len(cached_files)), intcomma(size)),
            "# SIGNATURE: %s" % hashlib.sha1('\n'.join(hash_lines)).hexdigest(),
            "CACHE:",
            ))
    manifest_lines.extend(cached_files)

    manifest_file = open(MANIFEST_FILENAME, 'w')
    manifest_file.write('\n'.join(manifest_lines) + '\n')
    manifest_file.close()

    # Make sure the listing for the manifest file is up to date
    # so it will be uploaded if changed.
    update_local_listing(MANIFEST_FILENAME)


def offline_command(args):
    """
    Build an app.manifest file to enable your application to be used offline.
    The manifest will be auto-updated on each subsequent PUT command.
    See http://diveintohtml5.org/offline.html for details on using a manifest in your application.
    """

    list_local_files()

    if os.path.exists(MANIFEST_FILENAME) and not options.force:
        print "%s already exists (use -f to overwrite)." % MANIFEST_FILENAME

    if not os.path.exists(MANIFEST_FILENAME) or options.force:
        print "Creating file %s." % MANIFEST_FILENAME
        default_manifest = (
            "CACHE MANIFEST\n"
            "# Cache files for offline access - see http://diveintohtml5.org/offline.html\n"
            "\n"
            "http://ajax.googleapis.com/ajax/libs/jquery/1.5/jquery.min.js\n"
            "/lib/beta/css/client.css\n"
            "/lib/beta/js/json2.min.js\n"
            "/lib/beta/js/utils.js\n"
            "/static/images/appbar/green-left.png\n"
            "/static/images/appbar/green-center.png\n"
            "/static/images/appbar/green-right.png\n"
            "/static/images/appbar/down.png\n"
            "/static/images/appbar/logo.png\n"
            "\n"
            "NETWORK:\n"
            "*\n\n"
            )
        manifest = open(MANIFEST_FILENAME, 'w')
        manifest.write(default_manifest + AUTOGEN_LINE)
        manifest.close()

    update_manifest(True)


def print_file_info(filename, metadata):
    sha1 = metadata['sha1'] or '-' * 40
    print '%s  %s  %s\t(%s bytes)' % (
        sha1,
        metadata['modified'].strftime('%Y-%m-%d %H:%M:%S'),
        filename,
        intcomma(metadata['size']))


def list_file_info(args, listing):
    filenames = listing.keys()
    filenames.sort()
    count = 0
    size = 0
    for filename in filenames:
        info = listing[filename]
        if args and not prefix_match(args, filename):
            continue
        print_file_info(filename, info)
        count += 1
        if info['size']:
            size += info['size']
    print "%s files: %s Total bytes" % (intcomma(count), intcomma(size))


def list_command(args):
    """
    List file information for all files on the remove server.
    If args specified, only show files that start with one of args as a path prefix.
    """
    # REVIEW: Can optimize by doing prefix queries of remote files.
    list_remote_files()
    list_file_info(args, options.listing)


def dir_command(args):
    """
    List file information for all files on the local directory (including SHA1 hashes).
    If args specified, only show files that start with one of args as a path prefix.
    """
    list_local_files()
    list_file_info(args, options.local_listing)


def listapps_command(args):
    """
    Display a list of apps that the user is allowed to write to.
    """
    url = options.root_url + 'apps?method=list'
    response = urllib2.urlopen(AuthRequest(url))
    result = json.loads(response.read(), object_hook=as_datetime)
    apps = result['items']
    print "Apps owned by you:"
    for app_name, app in apps.items():
        if app['owner'] == options.username:
            print app_name

    print "\nApps owned by others:"
    for app_name, app in apps.items():
        if app['owner'] != options.username:
            print "%s (by %s)" % (app_name, app['owner'])


def main():
    args = config()
    load_options()
    load_application()

    if not options.local_only:
        options.session_key = sign_in()
    check_args(args)
    globals()[options.command + '_command'](args)
    save_options()


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
