#!/usr/bin/env python

import os
import sys
import subprocess

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
Invalid name "assertContent"
manage.py:35: [W0403] Relative import 'settings'
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
    command = ['pylint']
    command.append('--output-format=parseable')
    command.append('--include-ids=yes')
    command.append('--reports=no')
    command.append('--disable-msg=' + disable_msg())
    command.extend(sys.argv[1:])
    if command[-1].startswith('-'):
        path = os.path.dirname(__file__) or '.'
        command.append(os.path.join(path, 'appengine'))
    command = ' '.join(command)
    # print "command: %s" % command
    pylint = subprocess.Popen(command, shell=True,
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
    if errors:
        sys.exit('found %d errors' % errors)


if __name__ == '__main__':
    main()
