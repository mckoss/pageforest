#!/usr/bin/env python

import os
import sys

import pftool


def find_in_path(file_name):
    path = os.environ['PATH']
    for d in path.split(os.pathsep):
        file_path = os.path.abspath(os.path.join(d, file_name))
        if os.path.exists(file_path):
            return file_path
    return file_name

if __name__ == '__main__':
    command = ['python2.5',
               find_in_path('dev_appserver.py'),
               '-a pageforest --show_mail_body --use_sqlite']
    command.extend(sys.argv[1:])
    command = ' '.join(command)
    if 'HOME' in os.environ:
        store_dir = os.path.join(os.environ['HOME'], 'dev_appserver.datastore')
        command += ' --datastore_path %s' % store_dir
    command += ' ' + pftool.app_dir
    print(command)
    code = os.system(command)
    sys.exit(code)
