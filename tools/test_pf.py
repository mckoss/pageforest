#!/usr/bin/env python
"""
Test the Pageforest Application Uploader - pf.py.
"""
import os
import shutil
import unittest

import pf

SERVER = 'pageforest.com'
TEST_APP = 'pfpytest'


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


class MockOptions(object):
    server = SERVER
    username = None
    password = None
    application = 'test-pf'
    docs = False
    verbose = True
    quiet = False
    raw = False
    force = False
    noop = False
    local_only = False
    files = {}

    def __init__(self, command=None):
        self.command = command


class TestAuthenticate(unittest.TestCase):
    test_dir = None

    def setUp(self):
        self.test_dir = os.path.join(os.path.dirname(__file__), 'test_pf')
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
        os.mkdir(self.test_dir)
        os.chdir(self.test_dir)
        print os.getcwd()
        app_json = open('app.json', 'wb')
        app_json.write("{}")
        app_json.close()
        pf.options = MockOptions()
        pf.load_application()

    def tearDown(self):
        pass

    def test_auth(self):
        pf.put_command(None)
        pf.get_command(None)


if __name__ == '__main__':
    unittest.main()
