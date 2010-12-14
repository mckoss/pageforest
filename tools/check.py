#!/usr/bin/env python

import os
import re
import sys
import time
import subprocess
from optparse import OptionParser

import pftool

LOGFILENAME = os.path.join(pftool.root_dir, 'check.log')
PEP8_EXCLUDE = 'jsmin.py shell.py'.split()
TEST_COUNT_REGEX = re.compile(r'Ran (\d+) tests in \d+\.\d+s')

# Remove these when they pass strong jslint
IGNORED_JSLINT = ['crypto', 'data', 'dateutil', 'events', 'json2',
                  'save-dialog']


def show_summary(nick):
    seconds = time.time() - options.job_started
    if options.verbose:
        print("=== %s time: %1.1fs ===" % (nick, seconds))
    else:
        sys.stdout.write(':%1.1fs ' % seconds)
        sys.stdout.flush()


def show_unittest_count():
    for line in file(LOGFILENAME):
        match = TEST_COUNT_REGEX.match(line)
        if match is None:
            continue
        if options.verbose:
            print line.rstrip()
        else:
            sys.stdout.write(':%d' % int(match.group(1)))


def attempt(nick, command):
    """
    Run a shell command and exit with error message if it fails.
    """
    if options.verbose:
        print command
    else:
        sys.stdout.write(nick)
        sys.stdout.flush()
    options.job_started = time.time()
    logfile = open(LOGFILENAME, 'w')
    returncode = subprocess.call(
        command.split(), stdout=logfile, stderr=subprocess.STDOUT)
    logfile.close()
    if nick in ('unittest', 'jstest'):
        show_unittest_count()
    show_summary(nick)
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


def part_callback(option, opt_str, value, parser, *args, **kwargs):
    if not hasattr(parser.values, 'checks'):
        parser.values.checks = []
    parser.values.checks.append(opt_str[2:])


def main():
    """
    Order of tests for optimal use of developer time:

    - Static anaysis tests (lint) - fix typos, undefined vars, etc.
    - Unit tests
    - Formatting and stylistic problems (pep8, and whitespace)
    """

    global options
    parser = OptionParser(
        usage="%prog [options]")
    parser.add_option('-v', '--verbose', action='store_true',
        help="run all checks with more output")
    parser.add_option('-p', '--prompt', action='store_true',
        help="ask before running any checks")
    parser.add_option('-n', '--nose', action='store_true',
        help="add unittest options --with-xunit --with-doctest")
    for name in ('pylint', 'jslint-tools', 'jslint-static', 'jslint-examples',
                 'unittest', 'jstest', 'pep8', 'whitespace'):
        parser.add_option('--' + name, action='callback',
                          callback=part_callback,
                          help="run only selected checks")
    (options, args) = parser.parse_args()
    unit_level = options.verbose and '-v2' or '-v0'

    all_checks = [
        ('pylint',
         "python %s -e %s %s" %
         (pftool.tool_path('lint.py'), pftool.app_dir, pftool.tools_dir)),

        ('jslint-tools',
         "python %s --strong --ignore beautify* --ignore fulljslint.js %s" %
         (pftool.tool_path('jslint.py'), pftool.tools_dir)),

        ('jslint-static',
         ("python %s " +
          " ".join(["--ignore %s.js" % script for script in IGNORED_JSLINT]) +
          " --strong %s") %
         (pftool.tool_path('jslint.py'),
          os.path.join(pftool.app_dir, 'static', 'src', 'js'))),

        ('jslint-examples',
         "python %s --strong %s" %
         (pftool.tool_path('jslint.py'),
          os.path.join(pftool.root_dir, 'examples'))),

        ('unittest', "python2.5 %s test %s" %
         (os.path.join(pftool.app_dir, 'manage.py'), unit_level)),

        ('jstest',
         "python %s -q -a" % pftool.tool_path('jstest.py')),

        ('pep8', "pep8 --max-line-length=100 --count --repeat --exclude %s %s" %
         (','.join(PEP8_EXCLUDE), pftool.root_dir)),

        ('whitespace', "python %s %s" %
         (pftool.tool_path('whitespace.py'), pftool.root_dir)),
        ]

    if not hasattr(options, 'checks'):
        options.checks = [name for name, command in all_checks]

    if options.prompt:
        yesno = raw_input("Do you want to run check.py? [Y/n] ")
        if yesno.lower().startswith('n'):
            return

    options.extra = {}
    if options.nose:
        options.extra['unittest'] = \
            '--nologcapture --with-xunit --with-doctest'

    options.started = time.time()
    for name, command in all_checks:
        if name in options.checks:
            if name in options.extra:
                command += ' ' + options.extra[name]
            attempt(name, command)
    print("total:%1.1fs" % (time.time() - options.started))


if __name__ == '__main__':
    main()
