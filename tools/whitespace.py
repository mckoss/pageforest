#!/usr/bin/env python

import os
import sys
from fnmatch import fnmatch
from optparse import OptionParser, make_option

import pftool

IGNORE_FILES = '*jquery-*.js *.xml .#* .pass'.split()


def short_path(path):
    if path.startswith('./'):
        path = path[2:]
    path = path.replace('../appengine/', '')
    return path


def check(path):
    errors = 0
    stripped = None
    for lineno, line in enumerate(file(path)):
        tab = line.find('\t')
        if tab >= 0:
            errors += 1
            print '%s:%d:%d: Please replace tabs with spaces.' % (
                short_path(path), lineno + 1, tab + 1)
        if line.endswith('\r\n'):
            errors += 1
            print '%s:%d:%d: Please replace CRLF with LF.' % (
                short_path(path), lineno + 1, len(line) - 2)
        stripped = line.rstrip()
        if stripped == line:
            errors += 1
            print '%s:%d:%d: Please add a newline at the end of file.' % (
                short_path(path), lineno + 1, len(line) + 1)
        if len(stripped) < len(line) - 1:
            errors += 1
            print '%s:%d:%d: Please remove trailing whitespace.' % (
                short_path(path), lineno + 1, len(stripped) + 1)
    if stripped == '':
        errors += 1
        print '%s:%d:%d: Please remove blank lines at the end of file.' % (
            short_path(path), lineno + 1, 1)
    return errors


def main():
    option_list = (
        make_option('-v', '--verbose', action='store_true'),
        make_option('-s', '--halt', action='store_true',
                    help="stop on error"),
        make_option('-i', '--ignore', action='append',
                    dest='ignored', metavar="FILENAME",
                    help="ignore files with this name"),
        )
    parser = OptionParser(option_list=option_list,
        usage="%prog [options] files_or_directories")
    (options, args) = parser.parse_args()
    total_errors = 0
    walk = pftool.FileWalker(ignored=IGNORE_FILES, pass_key='whitespace')
    for filename in walk.walk_files(*args):
        if options.verbose:
            print("checking %s" % filename)
        errors = check(filename)
        if errors == 0:
            walk.set_passing()
        total_errors += errors
        if options.halt and errors:
            break

    walk.save_pass_dict()

    if total_errors:
        sys.exit('%d errors' % errors)


if __name__ == '__main__':
    main()
