#!/usr/bin/env python

import os
import sys
from fnmatch import fnmatch

import pftool

IGNORE_DIR = '.hg .git .bzr .svn'.split()
IGNORE_EXT = '~ .pyc .gif .png .log .orig'.split()
IGNORE_FILES = 'jquery-*.js .#*'.split()


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
    errors = 0
    os.chdir(pftool.root_dir)
    for dirpath, dirnames, filenames in os.walk(pftool.root_dir):
        for ignored in IGNORE_DIR:
            if ignored in dirnames:
                dirnames.remove(ignored)
        for filename in filenames:
            if file_ignored(filename):
                continue
            path = os.path.join(dirpath, filename)
            errors += check(path)
    if errors:
        sys.exit('%d errors' % errors)


if __name__ == '__main__':
    main()