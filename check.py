#!/usr/bin/env python

import os
import sys
import subprocess


def attempt(command):
    """
    Run a shell command and exit with error message if it fails.
    """
    print command
    returncode = subprocess.call(command.split())
    if returncode:
        sys.exit("failed with return code %d" % returncode)


def main():
    path = os.path.dirname(__file__)
    attempt('pep8 --count --repeat --exclude .hg %s' % path)
    attempt('python %s/appengine/utils/json.py' % path)
    attempt('python %s/appengine/utils/http.py' % path)
    attempt('python %s/appengine/manage.py test -v0' % path)


if __name__ == '__main__':
    main()
