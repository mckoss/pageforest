#!/usr/bin/env python
"""
Test the Pageforest Application Uploader - pf.py.
"""
import os
import shlex
import subprocess
import shutil
import unittest

import pf

SERVER = 'pageforest.com'
TEST_APP = 'pfpytest'

try:
    _path = os.path.dirname(__file__)
except:
    _path = '.'

tools_dir = os.path.abspath(_path)
pf_cmd = os.path.join(tools_dir, 'pf.py')

"""
def test_command(args):
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
"""


def shell_command(command_line):
    args = shlex.split(command_line)
    print "args: %r" % args
    proc = subprocess.Popen(args,
                            stdout=subprocess.PIPE)
    (out, err) = proc.communicate()
    return (proc.returncode, out)


def assert_command(test, command_line, contains="", expect_code=0):
    (code, out) = shell_command(command_line)

    test.assertEqual(code, expect_code,
                     "Unexpected exit code, %d from %s" % (code, command_line))
    if contains:
        test.assertNotEqual(out.find(contains), -1,
                            "Missing '%s' from %s." % (contains, command_line))


class TestLocal(unittest.TestCase):

    def test_help(self):
        assert_command(self, pf_cmd + " dir")
        assert_command(self, pf_cmd + " --help", contains="help")


if __name__ == '__main__':
    # Setup a test directory for all the tests
    test_dir = os.path.join(tools_dir, 'test_pf')
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
    os.mkdir(test_dir)
    os.chdir(test_dir)

    unittest.main()

    # Remove the test directory
    # shutil.rmtree(test_dir)
