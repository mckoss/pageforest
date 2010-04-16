#!/usr/bin/env python

import os
import re
import sys
import subprocess

CHECK_FILES = """
tools/jslint-cl.js
appengine/static/js/namespace.js
appengine/static/js/json2.js
appengine/static/js/registration.js
""".split()

IGNORE_MESSAGES = """
Unexpected dangling '_' in '_
Missing space after 'function'.
json2.js:193:120: Line too long.
json2.js:194:143: Line too long.
json2.js:460:81: Line too long.
The body of a for in should be wrapped in an if statement
""".strip().splitlines()


def ignore(line):
    for message in IGNORE_MESSAGES:
        if message.rstrip() in line:
            return True


def main():
    path = os.path.dirname(__file__) or '.'
    os.chdir(os.path.join(path, 'tools'))
    command = ['java',
               'org.mozilla.javascript.tools.shell.Main',
               'jslint-cl.js']
    for filename in CHECK_FILES:
        command.append(os.path.join(path, *filename.split('/')))
    jslint = subprocess.Popen(' '.join(command), shell=True,
                              stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE)
    stdout, stderr = jslint.communicate()
    # Filter error messages and count errors.
    errors = 0
    stdout += stderr
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
