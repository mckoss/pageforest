#!/usr/bin/env python

import os
import sys
import subprocess
from optparse import OptionParser

PROJECT = 'appengine'


def load_app_yaml():
    """
    Read all lines of text from app.yaml and remove blank lines from
    the end of the file.
    """
    input = open(os.path.join(PROJECT, 'app.yaml'), 'r')
    lines = input.readlines()
    input.close()
    while lines and not lines[-1].strip():
        lines.pop(-1)
    return lines


def update_app_yaml(lines, **kwargs):
    """
    Write lines of text to app.yaml, replacing some settings according
    to kwargs. If options contain - (dash) in app.yaml, they can be
    specified with _ (underscore) instead.
    """
    output = open(os.path.join(PROJECT, 'app.yaml'), 'w')
    for line in lines:
        if ':' in line:
            key, value = line.split(':', 1)
            argname = key.strip().replace('-', '_')
            if argname in kwargs:
                line = key + ': ' + kwargs[argname] + '\n'
        output.write(line)
    output.close()


def attempt(command):
    """
    Run a shell command and exit with error message if it fails.
    """
    print command
    returncode = subprocess.call(command.split())
    if returncode:
        print "failed with return code", returncode
        sys.exit(returncode)


def main():
    usage = "usage: %prog [options]"
    parser = OptionParser(usage=usage)
    parser.add_option('-a', '--application', metavar='<name>',
                      default='pageforest', help="(default: pageforest)")
    parser.add_option('-v', '--version', metavar='<string>',
                      default='dev', help="(default: dev)")
    (options, args) = parser.parse_args()
    if not args:
        options.version = 'dev'
    elif len(args) == 1:
        options.version = args[0]
    else:
        parser.error("Too many command line arguments.")
    exclude = ['.git', '.hg', '.svn', '.bzr']
    # Check coding style.
    attempt('pep8 --count --repeat --exclude %s %s' %
            (','.join(exclude), PROJECT))
    # Check that all unit tests pass.
    attempt(os.path.join(PROJECT, 'manage.py') + ' test')
    # Check doctest for helper modules.
    attempt('python appengine/utils/json.py')
    # attempt('.hg/hooks/pre-commit')
    app_yaml = load_app_yaml()
    # Temporarily adjust application and version in app.yaml.
    update_app_yaml(app_yaml,
                    application=options.application,
                    version=options.version)
    try:
        attempt('appcfg.py update ' + PROJECT)
    finally:
        # Restore app.yaml to original.
        update_app_yaml(app_yaml)


if __name__ == '__main__':
    sys.exit(main())
