#!/usr/bin/env python

import os
import re

IGNORE_DIR = '.hg .git .bzr .svn'.split()

_path = os.path.dirname(__file__) or '.'

tools_dir = os.path.abspath(_path)
root_dir = os.path.abspath(os.path.join(_path, '..'))
app_dir = os.path.abspath(os.path.join(root_dir, 'appengine'))

reg_ext = re.compile(r".*\.([^\.]+)$")

def walk_files(args, extensions=None, ignored=None):
    """ Generator for files listed in args.

    Directories are walked.  If no args are given
    assumes we want to walk the current directory.
    """

    args = [os.path.abspath(arg) for arg in args]
    if len(args) == 0:
        args.append(os.getcwd())

    print("args: %r" % args)

    for arg in args:
        if os.path.isfile(arg):
            yield arg
            continue

        if not os.path.isdir(arg):
            print("File does not exist: %s" % arg)
            continue

        for dirpath, dirnames, filenames in os.walk(arg):
            for ignored in IGNORE_DIR:
                if ignored in dirnames:
                    dirnames.remove(ignored)
            for filename in filenames:
                if filename in ignored:
                    continue
                if extensions is not None:
                    ext = reg_ext.match(filename)
                    if ext and ext.group(1) not in extensions:
                        continue
                yield os.path.join(dirpath, filename)


if __name__ == '__main__':
    print "Helper library to return the pageforest project directories."
    print "root_dir: %s" % root_dir
    print "tools_dir: %s" % tools_dir
    print "app_dir: %s" % app_dir
