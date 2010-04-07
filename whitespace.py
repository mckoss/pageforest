#!/usr/bin/env python

import os
import sys

IGNORE_DIR = '.hg .git .bzr .svn'.split()
IGNORE_EXT = '.png .pyc'.split()


def short_path(path):
    if path.startswith('./'):
        path = path[2:]
    path = path.replace('../appengine/', '')
    return path


def check(path):
    errors = 0
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
    return errors


def main():
    errors = 0
    top = os.path.dirname(__file__) or '.'
    for dirpath, dirnames, filenames in os.walk(top):
        for ignored in IGNORE_DIR:
            if ignored in dirnames:
                dirnames.remove(ignored)
        for filename in filenames:
            base, ext = os.path.splitext(filename)
            if ext in IGNORE_EXT:
                continue
            path = os.path.join(dirpath, filename)
            errors += check(path)
    if errors:
        sys.exit('%d errors' % errors)


if __name__ == '__main__':
    main()
