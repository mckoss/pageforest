#!/usr/bin/env python

import os
import sys
from optparse import OptionParser
import subprocess
import shutil

import pftool
import jsmin
import settingsparser

sys.path.insert(0, pftool.app_dir)

import settings

STATIC_DIR = os.path.join(pftool.app_dir, 'static')
LIB_DIR = os.path.join(pftool.app_dir, 'lib')
SETTINGS_AUTO = os.path.join(pftool.app_dir, 'settingsauto.py')


def combine_files(settings_dict, overwrite=False, verbose=False):
    """
    Combine and minify static files.

    """
    for file_type in settings.FILE_GROUPS.keys():
        type_dir = os.path.join(STATIC_DIR, file_type)
        if file_type == 'js':
            version = settings_dict['JS_VERSION']
            file_ext = '.min.js'
            output_root = LIB_DIR
        else:
            version = settings_dict['MEDIA_VERSION']
            file_ext = '.' + file_type
            output_root = STATIC_DIR

        output_dir = os.path.join(output_root, version)
        levels = version.split('.')

        for alias, file_list in settings.FILE_GROUPS[file_type].items():
            output_name = alias + file_ext

            if verbose:
                print "Processing %s." % output_name

            output_file = open(os.path.join(output_dir, output_name), 'w')

            for filename in file_list:
                input_file = open(
                    os.path.join(type_dir, "%s.%s" % (filename, file_type)),
                    'r')
                comment = "/* Begin file: %s.%s */\n" % (filename, file_type)
                content = input_file.read()
                input_file.close()
                if file_type == 'js':
                    content = jsmin.jsmin(content) + '\n'
                content = comment + content
                output_file.write(content)
            output_file.close()

            # Copy latest version in each of the parent version folders
            for level in range(1, len(levels)):
                copy_path = os.path.join(output_root,
                                         '.'.join(levels[:level]),
                                         output_name)
                if verbose:
                    print("Copying file to %s" % copy_path)
                shutil.copyfile(os.path.join(output_dir, output_name),
                                copy_path)


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


def ensure_version_dirs(root, name, max_depth, options, settings_dict):
    """Make sure the versioned directories exists.

    e.g., ensure_dir(root, '1.0.5', 3)

    will ensure that all directories:

        root/1
        root/1.0
        root/1.0.5

    all exist or are created.
    """
    version = getattr(options, name + '_version', None)
    if version is None:
        version = settings_dict.get(name.upper() + "_VERSION", None)
    if version is None:
        levels = []
    else:
        levels = version.split('.')
    levels.extend(['0' for i in range(max_depth - len(levels))])
    if len(levels) > max_depth:
        sys.exit("Version number too long: %s", version)

    for level in range(1, max_depth + 1):
        path = os.path.join(root, '.'.join(levels[:level]))
        print("path: %s" % path)
        if not os.path.isdir(path):
            if options.verbose:
                print("Creating directory: %s" % path)
            os.mkdir(path)

    settings_dict[name.upper() + "_VERSION"] = '.'.join(levels)


def main():
    """
    Builds deployment files for pageforest.com.

    Files are combined from settings.FILE_GROUPS.  The current version numbers
    and md5 digests for each file are updated in settingsauto.py.
    """

    parser = OptionParser(
        usage="%prog [options]",
        description=trim(main.__doc__))
    parser.add_option('-o', '--overwrite', action='store_true',
        help="overwrite the current file version regardless of digest hash")
    parser.add_option('--js_version', action='store',
        help="set the current json version number - format: n.n.n")
    parser.add_option('--media_version', action='store',
        help="set the current media version number - format: n.n")
    parser.add_option('-v', '--verbose', action='store_true')
    (options, args) = parser.parse_args()

    os.chdir(pftool.root_dir)

    settings_auto = open(SETTINGS_AUTO, 'r')
    settings_dict = settingsparser.load(settings_auto.read())
    settings_auto.close()

    ensure_version_dirs(LIB_DIR, 'js', 3, options, settings_dict)
    ensure_version_dirs(STATIC_DIR, 'media', 1, options, settings_dict)

    combine_files(settings_dict,
                  overwrite=options.overwrite,
                  verbose=options.verbose)

    settings_auto = open(SETTINGS_AUTO, 'w')
    content = settingsparser.save(settings_dict)
    settings_auto.write(content)
    settings_auto.close()

    if options.verbose:
        print "=== begin %s ===" % SETTINGS_AUTO
        print content
        print "=== end %s ===" % SETTINGS_AUTO


if __name__ == '__main__':
    main()
