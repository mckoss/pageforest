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
        sys.exit("failed with return code %d, see %s" %
                 (returncode, LOGFILENAME))
    else:
        os.unlink(LOGFILENAME)


def main():
    path = os.path.dirname(__file__) or '.'
    if path != '.':
        global LOGFILENAME
        LOGFILENAME = os.path.join(path, LOGFILENAME)
    attempt('pep8 --count --repeat --exclude .hg %s' % path)
    attempt('python %s/pylint.py -e' % path)
    attempt('python %s/whitespace.py' % path)
    attempt('python %s/appengine/manage.py test -v0' % path)


if __name__ == '__main__':
    main()
