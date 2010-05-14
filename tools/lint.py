#!/usr/bin/env python

import os
import sys
from time import time
import subprocess
from optparse import OptionParser

import pftool

DISABLE_MESSAGES = """
C0111 Missing docstring
C0121 Missing required attribute "__revision__"
E0203 Access to member 'tags' before its definition line 197
E1101 Class 'KeyValue' has no 'get_by_key_name' member
E1103 Instance of 'KeyValue' has no 'put' member (but some types ...
F0401 Unable to import 'django.test' (No module named django)
R0903 Too few public methods
R0904 Too many public methods
W0142 Used * or ** magic
W0232 Class has no __init__ method
""".strip().splitlines()

IGNORE_MESSAGES = """
No config file found
Invalid name ""
Invalid name "urlpatterns"
Invalid name "setUp"
Invalid name "assert
manage.py:35: [W0403] Relative import 'settings'
from wildcard import
[E0611] No name 'Utils' in module 'email'
[E0611] No name 'forms' in module 'django'
[W6501] Specify string format arguments as logging function parameters
.process_request] Method could be a function
.process_response] Method could be a function
.process_exception] Method could be a function
Unused import handler404
Unused import handler500
Unused argument 'request'
Unused argument 'args'
Unused argument 'kwargs'
Use super on an old style class
Access to a protected member _rollback_on_exception
""".strip().splitlines()

DEPRECATED_MODULES = sorted(set("""
regsub rexec cl sv timing
addpack cmp cmpcache codehack dircmp dump find fmt
grep lockfile newdir ni packmail Para poly
rand reconvert regex regsub statcache tb tzparse
util whatsound whrandom zmod
gopherlib rgbimg  macfs rfc822  mimetools  multifile
posixfile gopherlib rgbimgmodule pre whrandom
rfc822 mimetools MimeWriter mimify rotor
TERMIOS statcache mpz xreadlines multifile sets
buildtools cfmfile macfs md5 sha
""".split()))


def disable_msg():
    result = []
    for line in DISABLE_MESSAGES:
        parts = line.split()
        if parts and len(parts[0]) == 5 and parts[0][1:].isdigit():
            result.append(parts[0])
    return ','.join(result)


def ignore(line):
    for message in IGNORE_MESSAGES:
        if message.rstrip() in line:
            return True


def exec_and_filter(command, options):
    if options.verbose:
        print command
    proc = subprocess.Popen(command, shell=True,
                              stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT)
    stdout, stderr = proc.communicate()
    # Filter error messages and count errors.
    errors = 0
    for line in stdout.splitlines():
        line = line.rstrip()
        if ignore(line) or not line:
            continue
        print line
        errors += 1
    return errors


def main():
    parser = OptionParser(
        usage="%prog [options] module_or_package")
    parser.add_option('-v', '--verbose', action='store_true')
    parser.add_option('-e', '--errors_only', action='store_true')
    parser.add_option('-f', '--force', action='store_true',
                      help="Force/fast - full check of all files.")
    (options, args) = parser.parse_args()

    if len(args) < 1:
        args.append('.')

    command = ['pylint']
    command.append('--ignore=shell.py')
    command.append('--output-format=parseable')
    command.append('--include-ids=yes')
    command.append('--reports=no')
    command.append('--notes=FIXME,XXX,TODO,REVIEW')
    command.append('--deprecated-modules=' + ','.join(DEPRECATED_MODULES))
    command.append('--good-names=ip')
    command.append('--disable-msg=' + disable_msg())
    if options.errors_only:
        command.append('-e')

    walk = pftool.FileWalker(matches=('*.py',),
                             pass_key='pylint')
    if options.force:
        walk.pass_key = None

    file_count = 0
    total_errors = 0
    start = time()

    # Pre-flight the test to count the number of file to be
    # processed.
    dirty_files = list(walk.walk_files(*args))
    file_count = len(dirty_files)

    if file_count > 3:
        # Execute a single pylint command.

        # Pass just the dirty files in the command line
        # (unless that would be too long).
        if file_count < 20:
            command.extend(dirty_files)
        else:
            command.extend(args)
        command = ' '.join(command)
        total_errors = exec_and_filter(command, options)

        # Optimization - mark all the files processed as passed
        if total_errors == 0:
            for file_name in dirty_files:
                walk.set_passing(pass_key='pylint', file_path=file_name)
    else:
        # File by file processing is slower (and less complete)
        # But we capture individual file errors and only
        # re-lint the subset that has changed.
        command = ' '.join(command)
        for file_name in dirty_files:
            errors = exec_and_filter(command + ' ' + file_name, options)
            if errors == 0:
                walk.set_passing(pass_key='pylint', file_path=file_name)
            total_errors += errors

    walk.save_pass_dict()

    elapsed = time() - start

    if total_errors or (options.verbose and file_count > 0):
        sys.exit(('Found %d errors in %d files ' +
                 '(in %1.1f seconds ... %1.1f secs per file).') %
                 (total_errors, file_count,
                  elapsed, elapsed / file_count))


if __name__ == '__main__':
    main()
