#!/usr/bin/env python

import os
import sys
import subprocess
from optparse import OptionParser

import pftool

LOGFILENAME = os.path.join(pftool.root_dir, 'check.log')
PEP8_EXCLUDE = '.hg jsmin.py'.split()

JSLINT_FILES = """
tools/jslint-cl.js
appengine/static/js/namespace.js
appengine/static/js/json2.js
appengine/static/js/registration.js
""".split()
JSLINT_FILES = [os.path.join(pftool.root_dir, *line.split('/')) \
                for line in JSLINT_FILES]


def attempt(command):
    """
    Run a shell command and exit with error message if it fails.
    """
    global options

    if options.verbose:
        print command
    else:
        sys.stdout.write('.')
        sys.stdout.flush()
    logfile = open(LOGFILENAME, 'w')
    returncode = subprocess.call(command.split(), stderr=logfile)
    logfile.close()
    if returncode:
        message = "Failed with return code %d" % returncode
        size = os.path.getsize(LOGFILENAME)
        if options.verbose:
            logfile = open(LOGFILENAME, 'r')
            sys.stdout.write(''.join(logfile.readlines()[:30]))
            logfile.close()
        elif size != 0:
            message += ' and %d bytes in %s' % (size, LOGFILENAME)
        sys.exit(message)
    else:
        os.unlink(LOGFILENAME)


def part_callback(option, opt_str, value, parser, *args, **kwargs):
    if not hasattr(parser.values, 'parts'):
        parser.values.parts = []
    parser.values.parts.append(opt_str[2:])


def main():
    global options

    all_parts = ('whitespace', 'jslint', 'pep8', 'pylint', 'unit')

    parser = OptionParser(
        usage="%prog [options]")
    parser.add_option('-v', '--verbose', action='store_true')
    parser.add_option('-p', '--prompt', action='store_true')
    for part in all_parts:
        parser.add_option('--' + part, action='callback',
                          callback=part_callback,
                          help="run the %s test (not all checks)" % part)
    (options, args) = parser.parse_args()
    if not hasattr(options, 'parts'):
        options.parts = list(all_parts)

    if options.prompt:
        yesno = raw_input("Do you want to run check.py? [Y/n] ")
        if yesno.lower().startswith('n'):
            return

    os.chdir(pftool.tools_dir)

    if 'whitespace' in options.parts:
        attempt("python whitespace.py")
    if 'unit' in options.parts:
        attempt("python settingsparser.py")
    if 'jslint' in options.parts:
        attempt("python jslint.py " + ' '.join(JSLINT_FILES))

    if 'pylint' in options.parts:
        os.chdir(pftool.app_dir)
        attempt("python %s -e %s" %
                (pftool.tool_path('lint.py'), pftool.app_dir))

    if 'pep8' in options.parts:
        attempt("pep8 --count --repeat --exclude %s %s" %
                (','.join(PEP8_EXCLUDE), pftool.root_dir))

    if 'unit' in options.parts:
        os.chdir(pftool.tools_dir)
        attempt("python %s test -v0" %
                os.path.join(pftool.app_dir, 'manage.py'))

    # Add newline after ...
    if not options.verbose:
        print


if __name__ == '__main__':
    main()
