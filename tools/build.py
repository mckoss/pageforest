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

MEDIA_DIR = os.path.join(pftool.app_dir, 'static')
SRC_DIR = os.path.join(pftool.app_dir, 'static', 'src')
LIB_DIR = os.path.join(pftool.app_dir, 'lib')
SETTINGS_AUTO = os.path.join(pftool.app_dir, 'settingsauto.py')


def combine_files(file_dict, output_root, version, verbose=False):
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
        levels = version.split('.')

        for alias, file_list in file_dict[file_type].items():
            output_name = alias + file_ext
            output_path = os.path.join(output_dir, output_name)
            if file_type == 'js':
                raw_output_path = os.path.join(output_dir, alias + '.js')

            if verbose:
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
            for level in range(1, len(levels)):
                copy_dir = os.path.join(output_root,
                                         '.'.join(levels[:level]),
                                         file_type)
                if verbose:
                    print("Copying to %s" % copy_dir)
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


def get_version(name, max_depth, options, settings_dict, verbose):
    """ Get fully expanded version string.

    The version string is padded with '0' parts up to the max_depth.
    """
    settings_name = name.upper() + "_VERSION"
    version = getattr(options, name + '_version', None)
    if version is None:
        version = settings_dict.get(settings_name, None)
    if version is None:
        levels = []
    else:
        levels = version.split('.')
    levels.extend(['0' for i in range(max_depth - len(levels))])
    if len(levels) > max_depth:
        sys.exit("Version number too long: %s", version)

    version = '.'.join(levels)
    settings_dict[settings_name] = version
    if verbose:
        print("%s version = %s" % (name, version))
    return version


def ensure_version_dirs(root, version, file_types, verbose):
    """ Make sure the versioned directories exists.

    e.g., ensure_dir(root, '1.0.5')

    will ensure that all directories:

        root/1
        root/1.0
        root/1.0.5

    all exist or are created.
    """
    levels = version.split('.')
    for level in range(1, len(levels) + 1):
        version_path = os.path.join(root, '.'.join(levels[:level]))
        if not os.path.isdir(version_path):
            if verbose:
                print("Creating directory: %s" % version_path)
            os.mkdir(version_path)
        for file_type in file_types:
            path = os.path.join(version_path, file_type)
            if not os.path.isdir(path):
                if verbose:
                    print("Creating directory %s" % path)
                os.mkdir(path)


def main():
    """
    Builds deployment files for pageforest.com.

    Files are combined from settings.FILE_GROUPS and settings.MEDIA_GROUPS.
    """
    parser = OptionParser(
        usage="%prog [options]",
        description=trim(main.__doc__))
    parser.add_option('-o', '--overwrite', action='store_true',
        help="overwrite the current file version regardless of digest hash")
    parser.add_option('--lib_version', action='store',
        help="set the current lib (published files) version - format: n.n.n")
    parser.add_option('--media_version', action='store',
        help="set the current media version string")
    parser.add_option('-v', '--verbose', action='store_true')
    (options, args) = parser.parse_args()

    os.chdir(pftool.root_dir)

    settings_auto = open(SETTINGS_AUTO, 'r')
    settings_dict = settingsparser.load(settings_auto.read())
    settings_auto.close()

    for (name, depth, output_dir, file_dict) in \
            (('lib', 3, LIB_DIR, settings.LIB_FILES),
             ('media', 1, MEDIA_DIR, settings.MEDIA_FILES)):
        version = get_version(name, depth, options,
                              settings_dict, options.verbose)
        ensure_version_dirs(output_dir, version, ('css', 'js'),
                            options.verbose)
        combine_files(file_dict, output_dir, version, options.verbose)

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
