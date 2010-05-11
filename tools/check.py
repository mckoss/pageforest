#!/usr/bin/env python

import os
import re
import sys
import imp
import time
import subprocess
from optparse import OptionParser

import pftool

LOGFILENAME = os.path.join(pftool.root_dir, 'check.log')
PEP8_EXCLUDE = 'jsmin.py shell.py'.split()
TEST_COUNT_REGEX = re.compile(r'Ran (\d+) tests in \d+\.\d+s')


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
    returncode = subprocess.call(command.split(), stderr=logfile)
    logfile.close()
    if nick == 'unittest':
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

    TODO: Optimize lint and pep8 by skipping files that have not
    been modified since the last check.
    """

    global options
    all_checks = [
        ('pylint', "python %s -e %s %s" %
         (pftool.tool_path('lint.py'), pftool.app_dir, pftool.tools_dir)),
        ('jslint',
         "python %s --strong --ignore beautify* --ignore fulljslint.js %s" %
         (pftool.tool_path('jslint.py'), pftool.tools_dir)),
        ('jslint-weak', "python %s --weak %s" %
         (pftool.tool_path('jslint.py'),
          os.path.join(pftool.app_dir, 'static', 'src', 'js'))),
        ('doctest', "python %s" % pftool.tool_path('settingsparser.py')),
        ('unittest', "python %s test -v0" %
         (os.path.join(pftool.app_dir, 'manage.py'))),
        ('pep8', "pep8 --count --repeat --exclude %s %s" %
         (','.join(PEP8_EXCLUDE), pftool.root_dir)),
        ('whitespace', "python %s %s" %
         (pftool.tool_path('whitespace.py'), pftool.root_dir)),
        ]

    parser = OptionParser(
        usage="%prog [options]")
    parser.add_option('-v', '--verbose', action='store_true',
        help="run all checks with more output")
    parser.add_option('-p', '--prompt', action='store_true',
        help="ask before running any checks")
    for name, command in all_checks:
        parser.add_option('--' + name, action='callback',
                          callback=part_callback,
                          help="run only selected checks")
    (options, args) = parser.parse_args()
    if not hasattr(options, 'checks'):
        options.checks = [name for name, command in all_checks]

    if options.prompt:
        yesno = raw_input("Do you want to run check.py? [Y/n] ")
        if yesno.lower().startswith('n'):
            return

    options.extra = {}
    try:
        imp.find_module('django_nose')
        options.extra['unittest'] = \
            '--nologcapture --with-xunit --with-doctest'
    except ImportError:
        pass

    options.started = time.time()
    for name, command in all_checks:
        if name in options.checks:
            if name in options.extra:
                command += ' ' + options.extra[name]
            attempt(name, command)
    print("total:%1.1fs" % (time.time() - options.started))


if __name__ == '__main__':
    main()
