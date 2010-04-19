#!/usr/bin/env python

import os
import sys
import subprocess

import pftool

LOGFILENAME = os.path.join(pftool.root_dir, 'check.log')
PEP8_EXCLUDE = '.hg jsmin.py'.split()


def attempt(command):
    """
    Run a shell command and exit with error message if it fails.
    """
    print command
    logfile = open(LOGFILENAME, 'w')
    returncode = subprocess.call(command.split(), stderr=logfile)
    logfile.close()
    if returncode:
        message = "Failed with return code %d" % returncode
        size = os.path.getsize(LOGFILENAME)
        if size:
            message += ' and %d bytes in %s' % (size, LOGFILENAME)
        sys.exit(message)
    else:
        os.unlink(LOGFILENAME)


def main():
    if '--prompt' in sys.argv:
        yesno = raw_input("Do you want to run check.py? [Y/n] ")
        if yesno.lower().startswith('n'):
            return

    os.chdir(pftool.tool_dir)
    attempt('python whitespace.py')
    attempt('python settingsparser.py')
    attempt('python jslint.py')
    attempt('python lint.py -e')

    attempt('pep8 --count --repeat --exclude %s %s' %
            (','.join(PEP8_EXCLUDE), pftool.root_dir))

    attempt('python %s test -v0' %
            os.path.join(pftool.root_dir, 'appengine',  'manage.py'))


if __name__ == '__main__':
    main()
