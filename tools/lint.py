#!/usr/bin/env python

import os
import sys
import subprocess
from optparse import OptionParser

import pftool

DISABLE_MESSAGES = """
C0111 Missing docstring
C0121 Missing required attribute "__revision__"
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
Wildcard import settingsauto
from wildcard import
[E0611] No name 'Utils' in module 'email'
[E0611] No name 'forms' in module 'django'
[W0402] Uses of a deprecated module 'string'
[W0403] Relative import 'settingsauto'
[W6501] Specify string format arguments as logging function parameters
.process_request] Method could be a function
Unused import handler404
Unused import handler500
Unused argument 'request'
Unused argument 'args'
Unused argument 'kwargs'
Use super on an old style class
Access to a protected member _rollback_on_exception
""".strip().splitlines()


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
        parser.error("missing module or package")

    command = ['pylint']
    command.append('--output-format=parseable')
    command.append('--include-ids=yes')
    command.append('--reports=no')
    command.append('--notes=FIXME,XXX,TODO,REVIEW')
    command.append('--good-names=ip')
    command.append('--disable-msg=' + disable_msg())
    if options.errors_only:
        command.append('-e')

    if options.force:
        command.extend(args)
        command = ' '.join(command)
        total_errors = exec_and_filter(command, options)
    else:
        # File by file processing is slower and less complete
        # But we capture individual file errors and only
        # lint the subset that has changed.
        command = ' '.join(command)
        walk = pftool.FileWalker(matches=('*.py',),
                                 pass_key='pylint')
        total_errors = 0
        for file_name in walk.walk_files(*args):
            errors = exec_and_filter(command + ' ' + file_name, options)
            if errors == 0:
                walk.set_passing()
            total_errors += errors
        walk.save_pass_dict()

    if total_errors:
        sys.exit('found %d errors' % total_errors)


if __name__ == '__main__':
    main()
