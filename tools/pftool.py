#!/usr/bin/env python

import os

_path = os.path.dirname(__file__) or '.'

tools_dir = os.path.abspath(_path)
root_dir = os.path.abspath(os.path.join(_path, '..'))
app_dir = os.path.abspath(os.path.join(root_dir, 'appengine'))

if __name__ == '__main__':
    print "Helper library to return the pageforest project directories."
    print "root_dir: %s" % root_dir
    print "tools_dir: %s" % tools_dir
    print "app_dir: %s" % app_dir
