#!/usr/bin/env python

import os
import sys
import subprocess
import shutil
from hashlib import sha1

import tools.jsmin as jsmin
import tools.settingsparser as settingsparser

import appengine.settings as settings

STATIC_DIR = "appengine/static"
SETTINGS_AUTO = "appengine/settingsauto.py"


def main():
    """
    Combine and minify static files.

    MEDIA_VERSION is updated if files have changed since the previous build.
    """
    path = os.path.dirname(__file__) or '.'
    os.chdir(path)

    settings_auto = open(SETTINGS_AUTO, 'r')
    settings_dict = settingsparser.load(settings_auto.read())
    settings_auto.close()

    # The initial condition is MEDIA_VERSION zero with no content
    if 'MEDIA_VERSION' not in settings_dict:
        settings_dict['MEDIA_VERSION'] = 0
        settings_dict['MEDIA_DIGEST_0'] = sha1("").hexdigest()

    all_content = ""
    for file_type in settings.FILE_GROUPS.keys():
        for alias, file_list in settings.FILE_GROUPS[file_type].items():
            output_name = "%s.%s" % (alias, file_type)
            print "Building %s" % output_name
            output_file = open("%s/%s/%s" %
                               (STATIC_DIR, file_type, output_name),
                                'w')
            for filename in file_list:
                input_file = open("%s/%s/%s.%s" %
                                  (STATIC_DIR, file_type, filename, file_type),
                                  'r')
                comment = "/* Begin file: %s.%s */\n" % (filename, file_type)
                content = input_file.read()
                if file_type == 'js':
                    content = jsmin.jsmin(content) + '\n'
                input_file.close()
                output_file.write(comment + content)
                all_content += content
            output_file.close()

    digest = sha1(all_content).hexdigest()

    if digest != settings_dict['MEDIA_DIGEST_%s' %
                 settings_dict['MEDIA_VERSION']]:
        settings_dict['MEDIA_VERSION'] += 1
        settings_dict['MEDIA_DIGEST_%s' %
                      settings_dict['MEDIA_VERSION']] = digest

        for file_type in settings.FILE_GROUPS.keys():
            for alias in settings.FILE_GROUPS[file_type].keys():
                source_name = "%s/%s/%s.%s" %
                              (STATIC_DIR, file_type, alias, file_type)
                dest_name = "%s/%s/%s-%s.%s" % (STATIC_DIR, file_type, alias,
                                                settings_dict['MEDIA_VERSION'],
                                                file_type)
                shutil.copyfile(source_name, dest_name)

        print "Updating to MEDIA_VERSION = %s" % settings_dict['MEDIA_VERSION']
        settings_auto = open(SETTINGS_AUTO, 'w')
        settings_auto.write(settingsparser.save(settings_dict))
        settings_auto.close()

if __name__ == '__main__':
    main()
