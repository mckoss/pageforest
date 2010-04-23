#!/usr/bin/env python

import os
import re
import sys
import subprocess
from optparse import OptionParser, make_option
import re

import pftool

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
    option_list = (
        make_option('-l', '--level', type='choice',
                    choices=('weak', 'strong', 'strict'),
                    default='strong'),
        make_option('-v', '--verbose', action='store_true'),
        make_option('-s', '--halt', action='store_true',
                    help="stop on error"),
        make_option('-q', '--quiet', action='store_true',
                    help="just display error summary"),
        make_option('-i', '--ignore', action='append',
                    dest='ignored', metavar="FILENAME",
                    help="ignore files with this name"),
        )
    parser = OptionParser(option_list=option_list,
        usage="%prog [options] files_or_directories")
    (options, args) = parser.parse_args()

    save_dir = os.getcwd()

    filenames = pftool.walk_files(args,
                                  extensions=('js', 'json'),
                                  ignored=options.ignored)

    command = ['java',
               'org.mozilla.javascript.tools.shell.Main',
               'jslint-cl.js']

    total_errors = 0
    for filename in filenames:
        os.chdir(pftool.tools_dir)
        command.append(filename)
        if options.verbose:
            print(' '.join(command))
        jslint = subprocess.Popen(' '.join(command), shell=True,
                                  stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE)
        stdout, stderr = jslint.communicate()
        command.pop()
        os.chdir(save_dir)

        # Filter error messages and count errors.
        errors = 0
        stdout += stderr
        for line in stdout.splitlines():
            line = line.rstrip()
            if line == '' or ignore(line):
                continue
            if not options.quiet:
                print line
            errors += 1
        total_errors += errors
        if options.halt and errors:
            break
        if options.verbose or options.quiet:
            print("%s errors: %d" % (filename, errors))

    if total_errors:
        sys.exit("found %d errors" % total_errors)


if __name__ == '__main__':
    main()
