#!/usr/bin/env python

import os
import sys
from optparse import OptionParser
import subprocess
import shutil
from hashlib import md5

import tools.jsmin as jsmin
import tools.settingsparser as settingsparser

import appengine.settings as settings

STATIC_DIR = os.path.join("appengine", "static")
SETTINGS_AUTO = os.path.join("appengine", "settingsauto.py")


def combine_files(settings_dict, overwrite=False, verbose=False):
    """
    Combine and minify static files.

    """
    for file_type in settings.FILE_GROUPS.keys():
        type_dir = os.path.join(STATIC_DIR, file_type)

        for alias, file_list in settings.FILE_GROUPS[file_type].items():
            output_name = "%s.%s" % (alias, file_type)
            alias_key = "%s_%s" % (alias.upper(), file_type.upper())
            digest_key = "%s_DIGEST" % alias_key
            version_key = "%s_VERSION" % alias_key
            
            if verbose:
                print "Processing %s." % output_name

            if version_key not in settings_dict:
                settings_dict[version_key] = 0
                settings_dict[digest_key] = None

            output_file = open(os.path.join(type_dir, output_name), 'w')
            digest = md5()
            for filename in file_list:
                input_file = open(os.path.join(type_dir, "%s.%s" % (filename, file_type)),
                                  'r')
                comment = "/* Begin file: %s.%s */\n" % (filename, file_type)
                content = input_file.read()
                if file_type == 'js':
                    content = jsmin.jsmin(content) + '\n'
                input_file.close()
                content = comment + content
                digest.update(content)
                output_file.write(content)
            output_file.close()
            digest = digest.hexdigest()
            if overwrite or digest != settings_dict[digest_key]:
                settings_dict[digest_key] = digest
                if not overwrite:
                    settings_dict[version_key] += 1
                versioned_name = "%s-%s.%s" % (alias,
                                               settings_dict[version_key],
                                               file_type)
                print "Building file: %s" % versioned_name
                shutil.copyfile(os.path.join(type_dir, output_name),
                                os.path.join(type_dir, versioned_name))

def trim(docstring):
    """ Code http://www.python.org/dev/peps/pep-0257/ """
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
        
    Files are combined from settings.FILE_GROUPS.  The current version numbers
    and md5 digests for each file are updated in settingsauto.py.
    """
    
    parser = OptionParser(
        usage="%prog [options]",
        description=trim(main.__doc__))
    parser.add_option('-o', '--overwrite', action='store_true',
        help="overwrite the current file version regardless of digest hash")
    parser.add_option('-v', '--verbose', action='store_true')
    (options, args) = parser.parse_args()
    
    path = os.path.dirname(__file__) or '.'
    os.chdir(path)

    settings_auto = open(SETTINGS_AUTO, 'r')
    settings_dict = settingsparser.load(settings_auto.read())
    settings_auto.close()

    combine_files(settings_dict, overwrite=options.overwrite, verbose=options.verbose)

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
