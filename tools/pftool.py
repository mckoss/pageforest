#!/usr/bin/env python

import os
import re
from fnmatch import fnmatch

IGNORE = """
.hg .git .bzr .svn .hgignore
*~ *# *.orig *.log
*.png *.gif *.pdf *.jpg *.pyc
""".split()

_path = os.path.dirname(__file__) or '.'

tools_dir = os.path.abspath(_path)
root_dir = os.path.abspath(os.path.join(_path, '..'))
app_dir = os.path.abspath(os.path.join(root_dir, 'appengine'))

reg_ext = re.compile(r".*\.([^\.]+)$")


def ignore_filename(filename, matches=None, ignored=None):
    # Ignore patterns take precede3nce
    for pattern in ignored:
        if fnmatch(filename, pattern):
            return True
    if matches is None:
        return False
    # If matches are given, it must match one of them
    for pattern in matches:
        if fnmatch(filename, pattern):
            return False
    return True


def walk_files(args, matches=None, ignored=None):
    """ Generator for files listed in args.

    Directories are walked.  If no args are given
    assumes we want to walk the current directory.

    If matches is given, only files matching one of the patterns
    are returned.  Any files matching the passed in (and default)
    ignored patterns are skipped.
    """

    if ignored is None:
        ignored = []
    ignored.extend(IGNORE)

    args = [os.path.abspath(arg) for arg in args]
    if len(args) == 0:
        args.append(os.getcwd())

    for arg in args:
        if os.path.isfile(arg):
            yield arg
            continue

        if not os.path.isdir(arg):
            print("Not a file or directory: %s" % arg)
            continue

        for dirpath, dirnames, filenames in os.walk(arg):
            for dir in dirnames:
                if ignore_filename(dir, ignored=ignored):
                    dirnames.remove(dir)
            for filename in filenames:
                if ignore_filename(filename, matches=matches, ignored=ignored):
                    continue
                yield os.path.join(dirpath, filename)


def tool_path(filename):
    return os.path.join(tools_dir, filename)


if __name__ == '__main__':
    print "Helper library to return the pageforest project directories."
    print "root_dir: %s" % root_dir
    print "tools_dir: %s" % tools_dir
    print "app_dir: %s" % app_dir
