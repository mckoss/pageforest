#!/usr/bin/env python

import os
import sys
import subprocess
from optparse import OptionParser

from check import attempt

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


def main():
    usage = "usage: %prog [options]"
    parser = OptionParser(usage=usage)
    parser.add_option('-a', '--application', metavar='<name>',
        default='pageforest',
        help="override app name in app.yaml (default: pageforest)")
    parser.add_option('-v', '--version', metavar='<string>',
        help="override version in app.yaml (default: dev)")
    parser.add_option('-c', '--check', action='store_true',
        help="run tests but don't deploy to Google App Engine")
    (options, args) = parser.parse_args()
    # Accept version as command line argument without -v or --version.
    if len(args) == 1 and not options.version:
        options.version = args[0]
    elif args:
        parser.error("Unexpected command line arguments: " + ' '.join(args))
    if not options.version:
        options.version = 'dev'
    # Check coding style and unit tests.
    attempt('python check.py')
    # Load app.yaml from disk.
    app_yaml = load_app_yaml()
    # Temporarily adjust application and version in app.yaml.
    update_app_yaml(app_yaml,
                    application=options.application,
                    version=options.version)
    try:
        # Deploy source code to Google App Engine.
        attempt('appcfg.py update ' + PROJECT)
    finally:
        # Restore app.yaml to original.
        update_app_yaml(app_yaml)


if __name__ == '__main__':
    main()
