#!/usr/bin/env python

import os
import re
import sys
import subprocess
from optparse import OptionParser, make_option
import re

import pftool

RHINO = 'java org.mozilla.javascript.tools.shell.Main'
RHINO_DEBUG = 'java org.mozilla.javascript.tools.debugger.Main'

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
Redefinition of 'console'
""".strip().splitlines(),

    'strong': """
Unexpected dangling '_' in '_
Missing space after 'function'
Redefinition of 'console'
Use '!==' to compare with 'undefined'
Use '===' to compare with 'undefined'
Use '===' to compare with '0'
Use '!==' to compare with '0'
Missing radix parameter
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

    walk = pftool.FileWalker(matches=('*.js', '*.json'),
                             ignored=options.ignored,
                             pass_key='jslint-' + options.level)
    dirty_files = list(walk.walk_files(*args))

    # LAME: This chdir is need because jslint-cl has a load that only
    # works in the tools directory and rhino has no way to discover
    # the path of the currently executing file. So we have to evaluate
    # all the command line args BEFORE enumerating them.
    os.chdir(pftool.tools_dir)

    total_errors = 0
    for file_name in dirty_files:
        command = RHINO + ' jslint-cl.js --' + options.level + ' ' + file_name
        if options.verbose:
            print(command)
        jslint = subprocess.Popen(command,
                                  shell=True,
                                  stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE)
        stdout, stderr = jslint.communicate()

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
        if errors == 0:
            walk.set_passing(file_path=file_name)
        total_errors += errors

    walk.save_pass_dict()

    if total_errors:
        sys.exit("found %d errors" % errors)


if __name__ == '__main__':
    main()
