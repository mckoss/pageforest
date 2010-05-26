#!/usr/bin/env python

import os
import sys
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


def ensure_dir(dirname):
    """
    Create directory (and its parents) if necessary.
    """
    if os.path.exists(dirname):
        return
    if options.verbose:
        print("Creating %s" % dirname)
    os.makedirs(dirname)


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
        levels = version.split('.')

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
                input_file = open(
                    os.path.join(input_dir, "%s.%s" % (filename, file_type)),
                    'r')
                comment = "/* Begin file: %s.%s */\n" % (filename, file_type)
                content = input_file.read()
                input_file.close()
                if file_type == 'js':
                    raw_output_file.write(comment + content)
                    content = jsmin.jsmin(content) + '\n'
                output_file.write(comment + content)

            output_file.close()
            if file_type == 'js':
                raw_output_file.close()

            # Copy latest version in each of the parent version folders
            for level in range(len(levels) - 1, 0, -1):
                copy_dir = os.path.join(output_root,
                                         '.'.join(levels[:level]),
                                         file_type)
                ensure_dir(copy_dir)
                if options.verbose:
                    print(" Copy to %s" % copy_dir)
                shutil.copyfile(os.path.join(output_dir, output_name),
                                os.path.join(copy_dir, output_name))

                if file_type == 'js':
                    shutil.copyfile(os.path.join(output_dir, alias + '.js'),
                                    os.path.join(copy_dir, alias + '.js'))


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


def main():
    """
    Builds deployment files for pageforest.com.

    Files are combined from settings.FILE_GROUPS and settings.MEDIA_GROUPS.
    """
    global options
    parser = OptionParser(
        usage="%prog [options]",
        description=trim(main.__doc__))
    parser.add_option('-v', '--verbose', action='store_true')
    (options, args) = parser.parse_args()

    os.chdir(pftool.root_dir)
    combine_files(LIB_DIR, settings.LIB_VERSION, settings.LIB_FILES)
    combine_files(MEDIA_DIR, settings.MEDIA_VERSION, settings.MEDIA_FILES)


if __name__ == '__main__':
    main()
