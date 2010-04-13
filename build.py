#!/usr/bin/env python

import os
import sys
import subprocess
import shutil
from hashlib import md5

import tools.jsmin as jsmin
import tools.settingsparser as settingsparser

import appengine.settings as settings

STATIC_DIR = "appengine/static/"
SETTINGS_AUTO = "appengine/settingsauto.py"


def combine_files(settings_dict):
    """
    Combine and minify static files.

    """
    for file_type in settings.FILE_GROUPS.keys():
        type_dir = STATIC_DIR + file_type + "/"

        for alias, file_list in settings.FILE_GROUPS[file_type].items():
            output_name = "%s.%s" % (alias, file_type)
            alias_key = "%s_%s" % (alias.upper(), file_type.upper())
            digest_key = "%s_DIGEST" % alias_key
            version_key = "%s_VERSION" % alias_key

            if version_key not in settings_dict:
                settings_dict[version_key] = 0
                settings_dict[digest_key] = None

            output_file = open(type_dir + output_name, 'w')
            digest = md5()
            for filename in file_list:
                input_file = open("%s%s.%s" % (type_dir, filename, file_type),
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
            if digest != settings_dict[digest_key]:
                settings_dict[digest_key] = digest
                settings_dict[version_key] += 1
                versioned_name = "%s-%s.%s" % (alias,
                                               settings_dict[version_key],
                                               file_type)
                print "Building file: %s" % versioned_name
                shutil.copyfile(type_dir + output_name,
                                type_dir + versioned_name)


def main():
    """ Build deployable version of pageforest. """

    path = os.path.dirname(__file__) or '.'
    os.chdir(path)

    settings_auto = open(SETTINGS_AUTO, 'r')
    settings_dict = settingsparser.load(settings_auto.read())
    settings_auto.close()

    combine_files(settings_dict)

    settings_auto = open(SETTINGS_AUTO, 'w')
    settings_auto.write(settingsparser.save(settings_dict))
    settings_auto.close()

if __name__ == '__main__':
    main()
