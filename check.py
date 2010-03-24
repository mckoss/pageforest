#!/usr/bin/env python

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
    attempt('pep8 --count --repeat --exclude .hg .')
    attempt('python appengine/utils/json.py')
    attempt('python appengine/manage.py test -v0')


if __name__ == '__main__':
    main()
