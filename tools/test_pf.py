#!/usr/bin/env python
"""
Test the Pageforest Application Uploader - pf.
"""
import os
import time
import shlex
import subprocess
import shutil
import unittest
from random import random
import hashlib

try:
    try:
        import json  # Python 2.6
    except ImportError:
        from django.utils import simplejson as json  # Django
except ImportError:
    import simplejson as json  # Please easy_install simplejson

import pf

SERVER = 'pageforest.com'
#SERVER = 'pageforest.appspot.com'
OPTIONS_FILENAME = '.pf'

APP_JSON_FILENAME = 'app.json'
TEST_APP = 'test-pf'
APP_JSON_INIT = '{"application": "%s"}\n' % TEST_APP
APP_JSON_SHA1 = hashlib.sha1("{}\n").hexdigest()

try:
    _path = os.path.dirname(__file__)
except:
    _path = '.'

tools_dir = os.path.abspath(_path)
test_dir = os.path.join(tools_dir, TEST_APP)
pf_cmd = os.path.join(tools_dir, 'pf.py')


def shell_command(command_line, stdin=None):
    args = shlex.split(command_line)
    proc = subprocess.Popen(args,
                            stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE)
    (out, err) = proc.communicate(stdin or "")
    return (proc.returncode, out + err)


def assert_command(test, command_line, contains=None, not_contains=None, expect_code=0,
                   stdin=None):
    (code, out) = shell_command(command_line, stdin=stdin)

    test.assertEqual(code, expect_code,
                     "Unexpected exit code, %d from '%s'\n%s" % (code, command_line, out))

    def list_default(param):
        if param is None:
            return ()
        if isinstance(param, basestring):
            return (param,)
        return param

    contains = list_default(contains)
    not_contains = list_default(not_contains)

    for pattern in contains:
        info = ''
        if not isinstance(pattern, basestring):
            (pattern, info) = pattern
            info = " (%s)" % info
        test.assertNotEqual(out.find(pattern), -1,
                            "Missing '%s'%s from '%s'.\n---\n%s\n---" %
                            (pattern, info, command_line, out))

    for pattern in not_contains:
        test.assertEqual(out.find(pattern), -1,
                            "Should not have '%s' from '%s'.\n---\n%s\n---" %
                            (pattern, command_line, out))
    return out


def make_file(filename, contents):
    dirname = os.path.dirname(filename)
    if dirname:
        if not os.path.exists(dirname):
            os.makedirs(dirname)
    file = open(filename, 'w')
    file.write(contents)
    file.close


def read_json_file(filename):
    if not os.path.exists(filename):
        return {}
    file = open(filename, 'r')
    options = json.loads(file.read())
    file.close()
    return options


class TestPF(unittest.TestCase):
    commands = ['dir', 'list', 'put', 'get', 'delete', 'listapps',
                'offline', 'vacuum', 'info', 'compile', 'make', 'config']

    options = ['help', 'server', 'username', 'password', 'application',
               'docs', 'verbose', 'quiet', 'raw', 'force', 'noop']

    def __init__(self, *args, **kwargs):
        super(TestPF, self).__init__(*args, **kwargs)
        self.files = {
            'test.txt': {'sha1': '202712ad248cc7617ffdcc6991358bf98debcb25',
                         'content': "This is a text file\n"},
            'index.html': {'sha1': 'd96af86c21ae75a057825d36d3f4214b55274c1c',
                           'content': "<html><body>Hello</body></html>"},
            'scripts/test.js': {'sha1': '55a72fae552af377887c1ea69fb5305a824f7dd4',
                                'content': "alert(1);"},
            }

    def make_unique(self):
        content = str(random())
        sha1 = hashlib.sha1(content).hexdigest()
        self.files['unique.txt'] = {'content': content, 'sha1': sha1}
        make_file('unique.txt', content)

    def setUp(self):
        global SERVER

        if os.path.exists(test_dir):
            shutil.rmtree(test_dir)
        os.mkdir(test_dir)
        os.chdir(test_dir)

        # Get user authentication information from pf file in tools directory.
        # Note: Run pf listapps to initialize it there.
        shutil.copyfile('../' + OPTIONS_FILENAME, OPTIONS_FILENAME)
        options = read_json_file(OPTIONS_FILENAME)
        if 'server' in options:
            SERVER = options['server']
        make_file(APP_JSON_FILENAME, APP_JSON_INIT)

        for file in self.files:
            make_file(file, self.files[file]['content'])

        self.make_unique()

    def tearDown(self):
        os.chdir(tools_dir)
        shutil.rmtree(test_dir)

    def check_file_hashes(self):
        contains = []
        for file in self.files:
            if file.endswith('.blob'):
                contains.append(file[:-5])
            else:
                contains.append(file)
            if 'sha1' in self.files[file]:
                contains.append((self.files[file]['sha1'], file))
        assert_command(self, pf_cmd + ' dir -f', contains=contains)
        options = read_json_file(OPTIONS_FILENAME)
        for file in self.files:
            if file.endswith('.blob'):
                options_file = file[:-5]
            else:
                options_file = file
            if 'sha1' not in self.files[file]:
                self.assertTrue(False, "Missing hash to compare to %s: %s" %
                                (file, options['files'][options_file]['sha1']))
            self.assertEqual(options['files'][options_file]['sha1'], self.files[file]['sha1'])


class TestLocal(TestPF):
    """
    Test pf purely local commands (no server access needed)
    """
    def test_help(self):
        out = assert_command(self, pf_cmd + ' --help', contains='Usage')
        for cmd in self.commands:
            self.assertNotEqual(out.find(cmd), -1, "Missing help on command: %s" % cmd)
        for option in self.options:
            self.assertNotEqual(out.find("--%s" % option), -1,
                                "Missing help on options: %s" % option)

    def test_no_arg(self):
        assert_command(self, pf_cmd, expect_code=2,
                       contains=["No command",
                                 "Usage:"])

    def test_dir(self):
        self.check_file_hashes()
        assert_command(self, pf_cmd + ' dir', contains=APP_JSON_SHA1)
        options = read_json_file(OPTIONS_FILENAME)
        self.assertEqual(options.get('server'), SERVER)
        self.assertTrue(options.get('username') is not None, "missing username")
        self.assertTrue(options.get('secret') is not None, "missing password/secret")
        self.assertTrue(options.get('files') is not None, "Local file cache missing")
        file_info = options['files'][APP_JSON_FILENAME]
        self.assertEqual(file_info['sha1'], APP_JSON_SHA1)
        self.assertEqual(file_info['size'], len(APP_JSON_INIT))
        self.assertTrue(file_info['time'] > 1299777982, "time looks wrong")

    def test_offline(self):
        assert_command(self, pf_cmd + ' offline',
                       contains="Creating file app.manifest")
        manifest = open("app.manifest").read()

        for file in self.files:
            self.assertTrue(manifest.find(file) != -1, "Missing manifest file: %s" % file)

        self.assertNotEqual(manifest.find("SIGNATURE"), -1, "Missing manifest Signature")
        self.assertNotEqual(manifest.find("AUTOGENERATED"), -1, "Missing AUTOGENERATED in manifest")


class TestServer(TestPF):
    """
    Test command of pf that interact with the server.
    """
    def test_info(self):
        assert_command(self, pf_cmd + ' info',
                       contains=["Application: %s" % TEST_APP,
                                 "Server: %s" % SERVER,
                                 "Username:",
                                 "pf.py version: 1.10",
                                 ])

    def test_info_verbose(self):
        assert_command(self, pf_cmd + ' -v info',
                       contains="Checking for updated pf.py version")

    def test_listapps(self):
        assert_command(self, pf_cmd + ' put')
        assert_command(self, pf_cmd + ' listapps',
                       contains=["Apps owned by you",
                                 "Apps owned by others",
                                 TEST_APP,
                                 ])

    def test_put_multi(self):
        """
        Overwrite the same file rapidly in succession, ensuring that the
        server-reported hash is the same as we compute locally.
        """
        for i in range(5):
            self.make_unique()
            assert_command(self, pf_cmd + ' put -f unique.txt',
                           contains=[("unique.txt", i)])
            assert_command(self, pf_cmd + ' list unique.txt',
                           contains=[(self.files['unique.txt']['sha1'], i)])
            # Avoid the hot-write cache on server
            time.sleep(1)

    def test_put(self):
        """
        Put uploads unique files first, and nothin on second.
        """
        assert_command(self, pf_cmd + ' put',
                       contains=['Uploading',
                                 'http://admin.' + TEST_APP,
                                 APP_JSON_FILENAME,
                                 'unique.txt'])
        # Do not upload files again
        assert_command(self, pf_cmd + ' put',
                       not_contains='unique.txt')

    def test_put_get(self):
        """
        Put, delete, and get.  Files should be the same.
        """
        assert_command(self, pf_cmd + ' put')
        for file in self.files:
            os.remove(file)
        assert_command(self, pf_cmd + ' dir')
        options = read_json_file(OPTIONS_FILENAME)
        for file in self.files:
            self.assertEqual(options['files'].get('file'), None, "File still listed: %s" % file)
        assert_command(self, pf_cmd + ' get')
        self.check_file_hashes()
        app_json = read_json_file(APP_JSON_FILENAME)
        for prop in app_json:
            self.assertTrue(app_json[prop] is not None,
                            "Invalid %s property value %s == None" %
                            (APP_JSON_FILENAME, prop))

        for prop in ['application', 'cloneable', 'owner',
                     'readers', 'writers', 'referers', 'secureData', 'tags',
                     'url', 'title']:
            self.assertTrue(prop in app_json,
                            "%s missing property: %s" % (APP_JSON_FILENAME, prop))

    def test_list(self):
        assert_command(self, pf_cmd + ' put')
        assert_command(self, pf_cmd + ' get', contains="Downloading")
        assert_command(self, pf_cmd + ' dir -f')
        options = read_json_file(OPTIONS_FILENAME)
        contains = [APP_JSON_FILENAME,
                    (options['files'][APP_JSON_FILENAME]['sha1'], APP_JSON_FILENAME),
                    ]
        for file, file_info in self.files.items():
            contains.append(('(%d bytes' % len(file_info['content']), file))
            contains.append((file_info['sha1'], file))
        assert_command(self, pf_cmd + ' list', contains=contains)

    def test_delete(self):
        assert_command(self, pf_cmd + ' put')
        assert_command(self, pf_cmd + ' delete no-such-file', contains="No files to delete")
        assert_command(self, pf_cmd + ' delete unique.txt', stdin="no\n",
                       contains=["Are you sure",
                                 "yes/no",
                                 "I'll take that as a no"])
        assert_command(self, pf_cmd + ' delete -f unique.txt')
        assert_command(self, pf_cmd + ' put', contains=['Uploading', 'unique.txt'])
        assert_command(self, pf_cmd + ' delete -f', contains=["Deleting", APP_JSON_FILENAME])
        contains = ['Uploading', APP_JSON_FILENAME]
        for file in self.files:
            contains.append(file + ' (%d bytes' % len(self.files[file]['content']))
        assert_command(self, pf_cmd + ' put', contains=contains)

    def test_vacuum(self):
        assert_command(self, pf_cmd + ' put')
        os.remove('unique.txt')
        assert_command(self, pf_cmd + ' vacuum', stdin="y\n",
                       contains=["DELETE 1 files",
                                 "Deleting: http://admin.%s.%s/unique.txt" % (TEST_APP, SERVER)])
        assert_command(self, pf_cmd + ' list', not_contains="unique.txt")


class TestDocs(TestPF):
    """
    Test document storage and retrieval.
    """
    def __init__(self, *args, **kwargs):
        super(TestDocs, self).__init__(*args, **kwargs)
        self.files.update({
                'docs/simpledoc': {'content': json.dumps({"blob": "Simple document"}),
                                   'sha1': 'ac71698ddb176ba75410fa4bc945b5750509c4d4'},
                'docs/complexdoc.blob': {'content': json.dumps({"blob": "Complex document"}),
                                         'sha1': '1cdcacdd13c15f626dc2b75fee06ad20d6a7bb67'},
                'docs/complexdoc/sub-blob': {'content': "Any old content.\n",
                                             'sha1': 'cbf686ad2feab1eb454e9c15ec1b38a2e5659c84'},
                })

    def test_put_noreader(self):
        assert_command(self, pf_cmd + ' put')
        assert_command(self, pf_cmd + ' put -d')

    def test_double_get(self):
        """
        Make sure second get -d downloads nothing.
        """
        assert_command(self, pf_cmd + ' put')
        assert_command(self, pf_cmd + ' put -d')
        assert_command(self, pf_cmd + ' get -d')
        assert_command(self, pf_cmd + ' get -d', not_contains="Downloading")

    def test_put_get(self):
        """
        Put, delete, and get.  Files should be the same.
        """
        assert_command(self, pf_cmd + ' put')
        assert_command(self, pf_cmd + ' put -d')
        shutil.rmtree('docs')
        assert_command(self, pf_cmd + ' get -d')
        assert_command(self, pf_cmd + ' dir -d')
        options = read_json_file(OPTIONS_FILENAME)
        for file in [doc for doc in self.files if doc.startswith('docs')]:
            self.assertEqual(options['files'].get('file'), None, "File still listed: %s" % file)
        assert_command(self, pf_cmd + ' get')
        self.check_file_hashes()


if __name__ == '__main__':
    unittest.main()
