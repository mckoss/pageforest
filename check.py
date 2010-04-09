#!/usr/bin/env python

import os
import sys
import subprocess

LOGFILENAME = 'check.log'


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
    path = os.path.dirname(__file__) or '.'
    os.chdir(path)
    if path != '.':
        global LOGFILENAME
        LOGFILENAME = os.path.join(path, LOGFILENAME)
    attempt('pep8 --count --repeat --exclude jsmin.py,.hg %s' % path)
    attempt('python %s/whitespace.py' % path)
    attempt('python %s/appengine/manage.py test -v0' % path)
    attempt('python %s/lint.py -e' % path)


if __name__ == '__main__':
    main()
