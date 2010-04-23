#!/usr/bin/env python

import os
import sys
from fnmatch import fnmatch
from optparse import OptionParser, make_option

import pftool

IGNORE_EXT = '~ .pyc .gif .png .log .orig'.split()
IGNORE_FILES = '*jquery-*.js .#*'.split()


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


def file_ignored(filename):
    for ext in IGNORE_EXT:
        if filename.endswith(ext):
            return True
    for pattern in IGNORE_FILES:
        if fnmatch(filename, pattern):
            return True


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
    errors = 0
    for filename in pftool.walk_files(args):
        if file_ignored(filename):
            continue
        if options.verbose:
            print("checking %s" % filename)
        errors += check(filename)
        if options.halt and errors:
            break

    if errors:
        sys.exit('%d errors' % errors)


if __name__ == '__main__':
    main()
