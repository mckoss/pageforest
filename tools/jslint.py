#!/usr/bin/env python

import os
import re
import sys
import subprocess
from optparse import OptionParser, make_option
import re

import pftool

IGNORED_MESSAGES = {
    'weak': """
Unexpected dangling '_' in '_
Missing space after '
Use '===' to compare with
Missing radix parameter
Expected '{'
Use '!==' to compare with
Unescaped '-'.
Use the array literal notation []
document.write can be a form of eval
eval is evil
Expected a 'break' statement before 'case'
Bad assignment
""".strip().splitlines(),

    'strong': """
Unexpected dangling '_' in '_
Missing space after 'function'
""".strip().splitlines(),

    'strict': """
""".strip().splitlines(),
}


def ignore(line, level):
    for message in IGNORED_MESSAGES[level]:
        if message.rstrip() in line:
            return True


def shorten_path(line):
    parts = line.split(':')
    if len(parts) >= 4 and parts[1].isdigit() and parts[2].isdigit():
        if len(parts[0]) > 30:
            parts[0] = os.path.basename(parts[0])
    return ':'.join(parts)


def main():
    levels = ('weak', 'strong', 'strict')
    option_list = (
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
    for level in levels:
        parser.add_option('--' + level, action='store_true',
                          help="set strictness level to " + level)
    (options, args) = parser.parse_args()
    for level in levels:
        if getattr(options, level):
            options.level = level
    if not hasattr(options, 'level'):
        options.level = 'strong'

    save_dir = os.getcwd()

    filenames = pftool.walk_files(
        args, matches=('*.js', '*.json'), ignored=options.ignored)

    command = ['java',
               'org.mozilla.javascript.tools.shell.Main',
               'jslint-cl.js',
               '--' + options.level]

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
            if line == '' or ignore(line, options.level):
                continue
            if not options.quiet:
                print shorten_path(line)
            errors += 1
        total_errors += errors
        if options.halt and errors:
            break
        if options.verbose or options.quiet and errors > 0:
            print("%s errors: %d" % (filename, errors))

    if total_errors:
        sys.exit("found %d errors" % total_errors)


if __name__ == '__main__':
    main()
