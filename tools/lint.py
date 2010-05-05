#!/usr/bin/env python

import os
import sys
import subprocess
from optparse import OptionParser

import pftool

DISABLE_MESSAGES = """
C0121 Missing required attribute "__revision__"
E1101 Class 'KeyValue' has no 'get_by_key_name' member
E1103 Instance of 'KeyValue' has no 'put' member (but some types ...
F0401 Unable to import 'django.test' (No module named django)
R0903 Too few public methods (0/2)
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
[W0402] Uses of a deprecated module 'string'
[W0403] Relative import 'settingsauto'
.process_request] Method could be a function
:1: [C0111] Missing docstring
Test] Missing docstring
.setUp] Missing docstring
.decorate] Missing docstring
.wrapper] Missing docstring
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


def main():
    parser = OptionParser(
        usage="%prog [options] module_or_package")
    parser.add_option('-v', '--verbose', action='store_true')
    parser.add_option('-e', '--errors_only', action='store_true')
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
    command = ' '.join(command)
    walk = pftool.FileWalker(matches=('*.py', ), pass_key='pylint')
    total_errors = 0
    for file_name in walk.walk_files(*args):
        if options.verbose:
            print "command: %s" % command
        pylint = subprocess.Popen(command + ' ' + file_name, shell=True,
                                  stdout=subprocess.PIPE,
                                  stderr=subprocess.STDOUT)
        stdout, stderr = pylint.communicate()
        # Filter error messages and count errors.
        errors = 0
        for line in stdout.splitlines():
            line = line.rstrip()
            if ignore(line) or not line:
                continue
            print line
            errors += 1
        if errors == 0:
            walk.set_passing()
        total_errors += errors

    walk.save_pass_dict()

    if total_errors:
        sys.exit('found %d errors' % errors)


if __name__ == '__main__':
    main()
