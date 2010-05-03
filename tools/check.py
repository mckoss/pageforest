#!/usr/bin/env python

import os
import sys
import subprocess
from optparse import OptionParser
from time import time

import pftool

LOGFILENAME = os.path.join(pftool.root_dir, 'check.log')
UNITTEST_OPTIONS = '-v0 --nologcapture --with-xunit --with-doctest'
PEP8_EXCLUDE = 'jsmin.py'.split()

total_time = 0.0


def start_timer():
    global start_time
    start_time = time()


def end_timer(nick):
    global start_time
    global options
    global total_time
    t = time() - start_time
    total_time += t
    if options.verbose:
        print("=== %s time: %1.1fs ===" % (nick, t))
    else:
        sys.stdout.write(":%1.1fs " % t)
        sys.stdout.flush()


def attempt(nick, command):
    """
    Run a shell command and exit with error message if it fails.
    """
    global options

    if options.verbose:
        print command
    else:
        sys.stdout.write(nick)
        sys.stdout.flush()
    logfile = open(LOGFILENAME, 'w')
    start_timer()
    returncode = subprocess.call(command.split(), stderr=logfile)
    end_timer(nick)
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
        ('pylint', "python %s -e %s" %
         (pftool.tool_path('lint.py'), pftool.app_dir)),
        ('jslint', "python jslint.py --strong " +
         "--ignore beautify* --ignore fulljslint.js"),
        ('jslint-weak', "python jslint.py --weak " +
         os.path.join(pftool.app_dir, 'static', 'src', 'js')),
        ('doctest', "python settingsparser.py"),
        ('unittest', "python %s test %s" %
         (os.path.join(pftool.app_dir, 'manage.py'), UNITTEST_OPTIONS)),
        ('pep8', "pep8 --count --repeat --exclude %s %s" %
         (','.join(PEP8_EXCLUDE), pftool.root_dir)),
        ('whitespace', "python whitespace.py"),
        ]

    parser = OptionParser(
        usage="%prog [options]")
    parser.add_option('-v', '--verbose', action='store_true',
        help="run all checks with more output")
    parser.add_option('-p', '--prompt', action='store_true',
        help="ask before running any checks")
    parser.add_option('-q', '--quick', action='store_true',
        help="skip tests that take longer than 10 seconds")
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

    for name, command in all_checks:
        if name in options.checks:
            if 'pylint' in name:
                os.chdir(pftool.app_dir)
            else:
                os.chdir(pftool.tools_dir)
            if options.quick and name == 'jslint-weak':
                continue
            attempt(name, command)
    print("total:%1.1fs" % total_time)


if __name__ == '__main__':
    main()
