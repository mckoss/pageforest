#!/usr/bin/env python
"""
Test the Pageforest Application Uploader - pf.py.
"""

SERVER = 'pageforest.com'
TEST_APP = 'pfpytest'

import unittest
import pf

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


class TestAuthenticate(unittest.TestCase):
    pass


if __name__ == '__main__':
    unittest.main()
