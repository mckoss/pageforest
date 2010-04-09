#!/usr/bin/env python

import os
import sys
import subprocess

import tools.jsmin as jsmin

import appengine.settings as settings

STATIC_DIR = "appengine/static"


def main():
    path = os.path.dirname(__file__) or '.'
    os.chdir(path)
    for file_type in settings.FILE_GROUPS.keys():
        for alias, file_list in settings.FILE_GROUPS[file_type].items():
            output_name = "%s-%s.%s" % (alias,
                                        settings.MEDIA_VERSION,
                                        file_type)
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
            output_file.close()


if __name__ == '__main__':
    main()
