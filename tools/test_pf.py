#!/usr/bin/env python
"""
Test the Pageforest Application Uploader - pf.py.
"""
import os
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
#SERVER = 'pageforest:8080'
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
                     "Unexpected exit code, %d from '%s'" % (code, command_line))

    def list_default(param):
        if param is None:
            return ()
        if isinstance(param, basestring):
            return (param,)
        return param

    contains = list_default(contains)
    not_contains = list_default(not_contains)

    for pattern in contains:
        test.assertNotEqual(out.find(pattern), -1,
                            "Missing '%s' from '%s'.\n---\n%s\n---" %
                            (pattern, command_line, out))

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
                'offline', 'vacuum', 'info']
    files = {
        'test.txt': {'sha1': '202712ad248cc7617ffdcc6991358bf98debcb25',
                     'content': "This is a text file\n"},
        'index.html': {'sha1': 'd96af86c21ae75a057825d36d3f4214b55274c1c',
                       'content': "<html><body>Hello</body></html>"},
        'scripts/test.js': {'sha1': '55a72fae552af377887c1ea69fb5305a824f7dd4',
                            'content': "alert(1);"},
        'unique.txt': {},
        }

    def setUp(self):
        if os.path.exists(test_dir):
            shutil.rmtree(test_dir)
        os.mkdir(test_dir)
        os.chdir(test_dir)

        # Get user authentication information from pf file in tools directory.
        # Note: Run pf.py listapps to initialize it there.
        shutil.copyfile('../.pf', '.pf')
        make_file(APP_JSON_FILENAME, APP_JSON_INIT)

        self.files['unique.txt']['content'] = str(random())
        self.files['unique.txt']['sha1'] = \
            hashlib.sha1(self.files['unique.txt']['content']).hexdigest()
        for file in self.files:
            make_file(file, self.files[file]['content'])

    def tearDown(self):
        os.chdir(tools_dir)
        shutil.rmtree(test_dir)

    def check_file_hashes(self):
        contains = ['5 files']
        for file in self.files:
            contains.append(file)
            contains.append(self.files[file]['sha1'])
        assert_command(self, pf_cmd + ' dir', contains=contains)
        options = read_json_file(OPTIONS_FILENAME)
        for file in self.files:
            self.assertEqual(options['files'][file]['sha1'], self.files[file]['sha1'])


class TestLocal(TestPF):
    """
    Test pf.py purely local commands (no server access needed)
    """
    def test_help(self):
        out = assert_command(self, pf_cmd + ' -help', contains='Usage')
        for cmd in self.commands:
            self.assertNotEqual(out.find(cmd), -1, "Missing help on command: %s" % cmd)

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

        self.assertTrue(manifest.find("SIGNATURE") != -1, "Missing manifest Signature")
        self.assertTrue(manifest.find("AUTOGENERATED") != -1, "Missing AUTOGENERATED in manifest")


class TestServer(TestPF):
    """
    Test command of pf.py that interact with the server.
    """
    def test_info(self):
        assert_command(self, pf_cmd + ' info',
                       contains=["Application: %s" % TEST_APP,
                                 "Server: http://admin.%s.%s" % (TEST_APP, SERVER),
                                 "Username:",
                                 ])
        assert_command(self, pf_cmd + ' -v info',
                       contains=["HTTP GET http://admin.%s.%s/auth/challenge" % (TEST_APP, SERVER),
                                 "Challenge:",
                                 "Response: http://admin.%s.%s/auth/verify/" % (TEST_APP, SERVER),
                                 "Session key: admin.%s|" % TEST_APP
                                 ])

    def test_listapps(self):
        assert_command(self, pf_cmd + ' listapps',
                       contains=["Apps owned by you",
                                 "Apps owned by others",
                                 TEST_APP,
                                 ])

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
        for prop in ['application', 'created', 'modified', 'cloneable', 'owner',
                     'readers', 'writers', 'referers', 'secureData', 'sha1', 'size', 'tags',
                     'url', 'icon', 'title']:
            self.assertTrue(prop in app_json,
                            "%s missing property: %s" % (APP_JSON_FILENAME, prop))

    def test_list(self):
        assert_command(self, pf_cmd + ' put')
        assert_command(self, pf_cmd + ' get', contains="Downloading")
        assert_command(self, pf_cmd + ' dir')
        options = read_json_file(OPTIONS_FILENAME)
        contains = [APP_JSON_FILENAME,
                    options['files'][APP_JSON_FILENAME]['sha1'],
                    ]
        for file, file_info in self.files.items():
            contains.append(file_info['sha1'])
            contains.append('(%d bytes' % len(file_info['content']))
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


if __name__ == '__main__':
    unittest.main()
