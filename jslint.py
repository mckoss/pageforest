#!/usr/bin/env python

import os
import re
import sys
import subprocess

CHECK_FILES = """
tools/rhino.js
appengine/static/js/namespace.js
""".split()

IGNORE_MESSAGES = """
Unexpected dangling '_' in '_
""".strip().splitlines()


def combine_jslint(path):
    os.system('cat %s %s > %s' % (
            os.path.join(path, 'tools/fulljslint.js'),
            os.path.join(path, 'tools/rhino.js'),
            os.path.join(path, 'tools/jslint.js'),
            ))


def ignore(line):
    for message in IGNORE_MESSAGES:
        if message.rstrip() in line:
            return True


def main():
    path = os.path.dirname(__file__) or '.'
    combine_jslint(path)
    command = ['java', 'org.mozilla.javascript.tools.shell.Main']
    command.append(os.path.join(path, 'tools/jslint.js'))
    for filename in CHECK_FILES:
        command.append(os.path.join(path, filename))
    jslint = subprocess.Popen(' '.join(command), shell=True,
                              stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT)
    stdout, stderr = jslint.communicate()
    # Filter error messages and count errors.
    errors = 0
    for line in stdout.splitlines():
        line = line.rstrip()
        if line == '' or ignore(line):
            continue
        print line
        errors += 1
    if errors:
        sys.exit('found %d errors' % errors)


if __name__ == '__main__':
    main()
