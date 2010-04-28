#!/usr/bin/env python

import os
import sys
import subprocess
from optparse import OptionParser
from time import time

import pftool

LOGFILENAME = os.path.join(pftool.root_dir, 'check.log')
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
        sys.stdout.write("(%1.1fs) " % t)
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
    start_timer()
    logfile = open(LOGFILENAME, 'w')
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
    else:
        os.unlink(LOGFILENAME)


def part_callback(option, opt_str, value, parser, *args, **kwargs):
    if not hasattr(parser.values, 'checks'):
        parser.values.checks = []
    parser.values.checks.append(opt_str[2:])


def main():
    global options

    all_checks = [
        ('whitespace', "python whitespace.py"),
        ('doctest', "python settingsparser.py"),
        ('pep8', "pep8 --count --repeat --exclude %s %s" %
         (','.join(PEP8_EXCLUDE), pftool.root_dir)),
        ('unit', "python %s test -v0" %
         os.path.join(pftool.app_dir, 'manage.py')),
        ('pylint', "python %s -e %s" %
         (pftool.tool_path('lint.py'), pftool.app_dir)),
        ('jslint', "python jslint.py --weak " +
         os.path.join(pftool.app_dir, 'static', 'src', 'js')),
        ('jslint-tools', "python jslint.py --strong " +
         "--ignore beautify* --ignore fulljslint.js"),
        ]

    parser = OptionParser(
        usage="%prog [options]")
    parser.add_option('-v', '--verbose', action='store_true')
    parser.add_option('-p', '--prompt', action='store_true')
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
            attempt(name, command)

    if not options.verbose:
        print  # Add newline after short output
    print("Total time: %1.1fs" % total_time)


if __name__ == '__main__':
    main()
