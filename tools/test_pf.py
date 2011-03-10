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

import pf

SERVER = 'pageforest.com'
TEST_APP = 'test-pf'

try:
    _path = os.path.dirname(__file__)
except:
    _path = '.'

tools_dir = os.path.abspath(_path)
test_dir = os.path.join(tools_dir, TEST_APP)
pf_cmd = os.path.join(tools_dir, 'pf.py')

"""
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
"""


def shell_command(command_line):
    args = shlex.split(command_line)
    proc = subprocess.Popen(args,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE)
    (out, err) = proc.communicate()
    return (proc.returncode, out + err)


def assert_command(test, command_line, contains=None, not_contains=None, expect_code=0):
    (code, out) = shell_command(command_line)

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
    file = open(filename, 'w')
    file.write(contents)
    file.close


class TestPF(unittest.TestCase):
    commands = ['dir', 'list', 'put', 'get', 'delete', 'listapps',
                'offline', 'vacuum', 'info']

    def setUp(self):
        if os.path.exists(test_dir):
            shutil.rmtree(test_dir)
        os.mkdir(test_dir)
        os.chdir(test_dir)

        # Get user authentication information from pf file in tools directory.
        # Note: Run pf.py listapps to initialize it there.
        shutil.copyfile('../.pf', '.pf')
        make_file('app.json', '{"application": "%s"}\n' % TEST_APP)

    def tearDown(self):
        os.chdir(tools_dir)
        shutil.rmtree(test_dir)


class TestLocal(TestPF):
    def test_help(self):
        out = assert_command(self, pf_cmd + ' -help', contains='Usage')
        for cmd in self.commands:
            self.assertNotEqual(out.find(cmd), -1, "Missing help on command: %s" % cmd)

    def test_no_arg(self):
        assert_command(self, pf_cmd, expect_code=2,
                       contains=["No command",
                                 "Usage:"])

    def test_dir(self):
        out = assert_command(self, pf_cmd + ' dir',
                             contains=['1 file',
                                       '5f36b2ea290645ee34d943220a14b54ee5ea5be5',
                                       ])

    def test_offline(self):
        assert_command(self, pf_cmd + ' offline',
                       contains="Creating file app.manifest")


class TestAuth(TestPF):
    def test_listapps(self):
        assert_command(self, pf_cmd + ' listapps',
                       contains=["Apps owned by you",
                                 "Apps owned by others",
                                 TEST_APP,
                                 ])


class TestPut(TestPF):
    def setUp(self):
        super(TestPut, self).setUp()
        make_file('test.txt', "This is a text file\n")
        make_file('unique.txt', str(random()))

    def test_dir(self):
        assert_command(self, pf_cmd + ' dir',
                       contains=['3 files',
                                 '202712ad248cc7617ffdcc6991358bf98debcb25',
                                 ])

    def test_put(self):
        assert_command(self, pf_cmd + ' put',
                       contains=['Uploading',
                                 'http://admin.test-pf.',
                                 'app.json',
                                 'unique.txt'])
        assert_command(self, pf_cmd + ' put',
                       not_contains='unique.txt')

if __name__ == '__main__':
    unittest.main()
