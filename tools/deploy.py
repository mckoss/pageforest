#!/usr/bin/env python

import os
import sys
import subprocess
from optparse import OptionParser

import pftool


def load_app_yaml():
    """
    Read all lines of text from app.yaml and remove blank lines from
    the end of the file.
    """
    input = open(os.path.join(pftool.app_dir, 'app.yaml'), 'r')
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
    output = open(os.path.join(pftool.app_dir, 'app.yaml'), 'w')
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
    parser.add_option('-a', '--application',
        default='pageforest', metavar='<name>',
        help="override app name in app.yaml (default: pageforest)")
    parser.add_option('-V', '--version',
        default='dev', metavar='<string>',
        help="override version in app.yaml (default: dev)")
    parser.add_option('-v', '--verbose', action='store_true',
        help="show more output")
    parser.add_option('-c', '--check', action='store_true',
        help="run tests but don't deploy to Google App Engine")
    parser.add_option('-i', '--ignore', action='store_true',
        help="ignore errors from check.py - USE WITH CAUTION")
    (options, args) = parser.parse_args()
    dash_v = options.verbose and '-v' or ''
    os.chdir(pftool.tools_dir)
    # Update auto-generated files (combined and minified JS and CSS).
    if os.system('python build.py ' + dash_v):
        sys.exit('build failed')
    # Check coding style and unit tests.
    if not options.ignore and os.system('python check.py ' + dash_v):
        sys.exit('check failed')
    # Load app.yaml from disk.
    app_yaml = load_app_yaml()
    # Temporarily adjust application and version in app.yaml.
    update_app_yaml(app_yaml,
                    application=options.application,
                    version=options.version)
    try:
        # Deploy source code to Google App Engine.
        if os.system('appcfg.py %s update %s' % (dash_v, pftool.app_dir)):
            sys.exit('failed')
    finally:
        # Restore app.yaml to original.
        update_app_yaml(app_yaml)


if __name__ == '__main__':
    main()
