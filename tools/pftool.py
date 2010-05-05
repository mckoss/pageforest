#!/usr/bin/env python

import os
import sys
import re
from fnmatch import fnmatch
import unittest

from django.utils import simplejson as json

IGNORE = """
.hg .git .bzr .svn .hgignore
*~ *# *.orig *.log
*.png *.gif *.pdf *.jpg *.pyc *.ico
TAGS
""".split()

try:
    _path = os.path.dirname(__file__)
except:
    _path = '.'

tools_dir = os.path.abspath(_path)
root_dir = os.path.abspath(os.path.join(_path, '..'))
app_dir = os.path.join(root_dir, 'appengine')

# for each file in the pass file we record:
# {file_path: {'modified': date, key1:True, key2: True}}
PASS_FILE = os.path.join(tools_dir, ".pass")

reg_ext = re.compile(r".*\.([^\.]+)$")


def tool_path(file_name):
    return os.path.join(tools_dir, file_name)


class FileWalker(object):
    def __init__(self, matches=None, ignored=None, pass_key=None, clean=False):
        """
        If matches is given, only files matching one of the patterns
        are returned.  Any files matching the passed in (and default)
        ignored patterns are skipped.

        If a pass_key (string) is given, once the file is marked as
        "passing" a particular test, it is not returned on subsequent
        walks unless the modification date of the file has changed.
        """
        self.matches = matches
        self.ignored = []
        self.ignored.extend(IGNORE)
        if ignored is not None:
            self.ignored.extend(ignored)
        self.pass_dict = {}
        self.pass_key = pass_key
        if clean:
            self.pass_dict = {}
        else:
            self.load_pass_dict()

    def load_pass_dict(self):
        try:
            pass_file = open(PASS_FILE, 'r')
            self.pass_dict = json.load(pass_file)
            pass_file.close()
        except:
            pass

    def save_pass_dict(self):
        pass_file = open(PASS_FILE, 'w')
        json.dump(self.pass_dict, pass_file, encoding="ascii",
                  indent=4, separators=(',', ':'))
        pass_file.close()

    def get_file_dict(self, file_path):
        file_path = file_path.lower()
        return self.pass_dict.get(file_path, None)

    def set_file_dict(self, file_path, file_dict):
        file_path = file_path.lower()
        self.pass_dict[file_path] = file_dict

    def set_passing(self):
        file_dict = self.get_file_dict(self.file_path)
        if file_dict is None:
            file_dict = {'modified': int(os.path.getmtime(self.file_path))}
            self.set_file_dict(self.file_path, file_dict)
        file_dict[self.pass_key] = True

    def has_passed(self, file_path):
        file_dict = self.get_file_dict(file_path)
        if file_dict is None:
            return False
        modified = int(os.path.getmtime(file_path))
        if file_dict['modified'] != modified:
            # File changed: wipe out cached pass states
            file_dict = {'modified': modified}
            self.set_file_dict(file_path, file_dict)
            return False
        return file_dict.get(self.pass_key, False)

    def ignore_dir(self, dir_name):
        """
        Decide on which directories to ignore.
        """
        for pattern in self.ignored:
            if fnmatch(dir_name, pattern):
                return True

    def ignore_file(self, file_name, file_path=None):
        """
        Decide on which files to ignore.
        """
        # Ignore patterns take precedence
        for pattern in self.ignored:
            if fnmatch(file_name, pattern):
                return True

        # Directories are only tested against the ignore pattern
        if file_path is None:
            return False

        # If matches are given, it must match one of them
        if self.matches:
            found_match = False
            for pattern in self.matches:
                if fnmatch(file_name, pattern):
                    found_match = True
                    break
            if not found_match:
                return True

        # See if the file has already passed the current test
        if file_path and self.has_passed(file_path):
            return True

        return False

    def walk_files(self, *args):
        """
        Generator for files listed in args.

        Directories are walked. If no args are given assumes we want
        to walk the current directory.

        Can only execute one instance of walk_files per class instance.
        """
        args = [os.path.abspath(arg) for arg in args]
        if len(args) == 0:
            args.append(os.getcwd())

        for arg in args:
            if os.path.isfile(arg):
                arg = os.path.abspath(arg).lower()
                self.file_path = arg
                yield arg
                continue

            if not os.path.isdir(arg):
                print("Not a file or directory: %s" % arg)
                continue

            for dir_path, dir_names, file_names in os.walk(arg):
                for dir_name in dir_names[:]:
                    if self.ignore_dir(dir_name):
                        dir_names.remove(dir_name)
                for file_name in file_names:
                    file_path = os.path.join(dir_path, file_name).lower()
                    if self.ignore_file(file_name, file_path):
                        continue
                    self.file_path = file_path
                    yield file_path


class TestPaths(unittest.TestCase):
    def test_basic(self):
        for path in (root_dir, tools_dir, app_dir):
            self.assertTrue(os.path.isdir(path))


class TestWalker(unittest.TestCase):
    def test_basic(self):
        walker = FileWalker(clean=True, pass_key='test')
        count = 0
        for file_path in walker.walk_files(tools_dir):
            self.assertTrue(os.path.isfile(file_path))
            count += 1
            self.assertTrue(count < 50)
            if file_path.endswith('.py'):
                walker.set_passing()
        walker.save_pass_dict()

        walker = FileWalker(pass_key='test')
        count2 = 0
        for file_path in walker.walk_files(tools_dir):
            count2 += 1
        self.assertTrue(count2 < count)

if __name__ == '__main__':
    print "Helper library to return the pageforest project directories."
    print "root_dir: %s" % root_dir
    print "tools_dir: %s" % tools_dir
    print "app_dir: %s" % app_dir
    print

    # Dump the current .pass file for the passed argument (or cwd)
    walker = FileWalker(matches=sys.argv[1:])
    for file_path in walker.walk_files():
        file_dict = walker.pass_dict.get(file_path, None)
        if file_dict:
            flags = file_dict.keys()
            flags.remove('modified')
        else:
            flags = ()
        print("%s: %s" % (file_path, ', '.join(flags)))

    # unittest.main()
