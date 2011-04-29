#!/usr/bin/env python

import os
import sys
import re
from optparse import OptionParser
import subprocess
import shutil

import pftool
import jsmin

sys.path.insert(0, pftool.app_dir)

import settings

MEDIA_DIR = os.path.join(pftool.app_dir, 'static')
SRC_DIR = os.path.join(pftool.app_dir, 'static', 'src')
LIB_DIR = os.path.join(pftool.app_dir, 'lib')

PF_FILENAME = 'pf.py'


def ensure_dir(dirname):
    """
    Create directory (and its parents) if necessary.
    """
    if os.path.exists(dirname):
        return
    if options.verbose:
        print("Creating %s" % dirname)
    os.makedirs(dirname)


def empty_dir(dirname):
    """
    Delete all files and subdirectories.
    """
    for filename in os.listdir(dirname):
        full_path = os.path.join(dirname, filename)
        if os.path.isdir(full_path):
            empty_dir(full_path)
            os.rmdir(full_path)
        else:
            os.remove(full_path)
        # print "Removed:", full_path


def combine_files(output_root, version, file_dict):
    """
    Combine and minify static files.

    js files are minified
    css files are concatenated
    """
    for file_type in file_dict.keys():
        input_dir = os.path.join(SRC_DIR, file_type)
        if file_type == 'js':
            file_ext = '.min.js'
        else:
            file_ext = '.' + file_type

        output_dir = os.path.join(output_root, version, file_type)
        ensure_dir(output_dir)
        empty_dir(output_dir)

        for alias, file_list in file_dict[file_type].items():
            output_name = alias + file_ext
            output_path = os.path.join(output_dir, output_name)
            if file_type == 'js':
                raw_output_path = os.path.join(output_dir, alias + '.js')

            if options.verbose:
                print("Building %s" % output_path)

            output_file = open(output_path, 'w')
            if file_type == 'js':
                raw_output_file = open(raw_output_path, 'w')

            for filename in file_list:
                input_file = open(os.path.join(input_dir, "%s.%s" % (filename, file_type)), 'r')
                comment = "/* Begin file: %s.%s */\n" % (filename, file_type)
                content = input_file.read()
                input_file.close()
                if file_type == 'js':
                    raw_output_file.write(comment + content)

                    # Check if minimized version already in library
                    minimized_file = os.path.join(input_dir, "%s.min.js" % filename)
                    if os.path.exists(minimized_file):
                        minimized_file = open(minimized_file, 'r')
                        content = minimized_file.read()
                        minimized_file.close()
                    else:
                        content = jsmin.jsmin(content) + '\n'

                output_file.write(comment + content)

            output_file.close()
            if file_type == 'js':
                raw_output_file.close()


def copy_files(output_root, source, version):
    """
    Copy files from source to version and prefix version folders.
    If version is '0.6.0', it will also copy to '0.6' and '0'.
    """
    levels = version.split('.')
    source_dir = os.path.join(output_root, source)
    for file_type in os.listdir(source_dir):
        type_dir = os.path.join(source_dir, file_type)
        for level in range(len(levels), 0, -1):
            copy_dir = os.path.join(
                output_root, '.'.join(levels[:level]), file_type)
            ensure_dir(copy_dir)
            if options.verbose:
                print(" Copy to %s" % copy_dir)
            for filename in os.listdir(type_dir):
                shutil.copyfile(os.path.join(type_dir, filename),
                                os.path.join(copy_dir, filename))


def trim(docstring):
    """
    Trim docstring for display.

    Code from http://www.python.org/dev/peps/pep-0257/
    """
    if not docstring:
        return ''
    # Convert tabs to spaces (following the normal Python rules)
    # and split into a list of lines:
    lines = docstring.expandtabs().splitlines()
    # Determine minimum indentation (first line doesn't count):
    indent = sys.maxint
    for line in lines[1:]:
        stripped = line.lstrip()
        if stripped:
            indent = min(indent, len(line) - len(stripped))
    # Remove indentation (first line is special):
    trimmed = [lines[0].strip()]
    if indent < sys.maxint:
        for line in lines[1:]:
            trimmed.append(line[indent:].rstrip())
    # Strip off trailing and leading blank lines:
    while trimmed and not trimmed[-1]:
        trimmed.pop()
    while trimmed and not trimmed[0]:
        trimmed.pop(0)
    # Return a single string:
    return '\n'.join(trimmed)


def build_pfpy():
    pf = open(os.path.join(pftool.tools_dir, PF_FILENAME), 'r').read()
    version = re.search("VERSION\s*=\s*'([^']+)'", pf)
    if not version:
        print "Could not find version string in %s" % PF_FILENAME
        exit(1)
    version = version.group(1)
    dist_file = os.path.join(pftool.dist_dir, '%s.%s' % (PF_FILENAME, version))
    if os.path.exists(dist_file):
        pf_dist = open(dist_file, 'r').read()
        if pf == pf_dist or not if_yes("%s already exists.  Overwrite?" % dist_file):
            return
    print "Creating new %s distribution: %s" % (PF_FILENAME, dist_file)
    print "Be sure to update the directory and push when ready."
    file = open(dist_file, 'w')
    file.write(pf)
    file.close


def if_yes(prompt):
    if options.force:
        return True

    answer = raw_input("%s (yes/no)? " % prompt)
    f = answer.lower().startswith('y')
    if not f:
        print "I'll take that as a no."
    return f


def main():
    """
    Builds deployment files for pageforest.com.

    Files are combined from settings.FILE_GROUPS and settings.MEDIA_GROUPS.
    """
    global options
    parser = OptionParser(
        usage="%prog [options]",
        description=trim(main.__doc__))
    parser.add_option('-v', '--verbose', action='store_true',
                      help="Show each file or directory action.")
    parser.add_option('-r', '--release', action='store_true',
                      help="Create a new LIB_VERSION directory.")
    parser.add_option('-f', '--force', action='store_true',
                      help="Update LIB_VERSION directory even if it exists.")
    (options, args) = parser.parse_args()

    os.chdir(pftool.root_dir)
    options.release = options.release or options.force
    if options.release:
        release_dir = os.path.join(LIB_DIR, settings.LIB_VERSION)
        if os.path.exists(release_dir) and not options.force:
            parser.error("Directory %s already exists." % release_dir)

    combine_files(MEDIA_DIR, settings.MEDIA_VERSION, settings.MEDIA_FILES)
    combine_files(LIB_DIR, 'beta', settings.LIB_FILES)
    if options.release:
        copy_files(LIB_DIR, 'beta', settings.LIB_VERSION)

    build_pfpy()


if __name__ == '__main__':
    main()
