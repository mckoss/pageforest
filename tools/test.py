#!/usr/bin/env python

import os
import sys

DEBUG_MODULE = "pdb"
#DEBUG_MODULE = "pudb.run"

from optparse import OptionParser

import pftool


def find_in_path(file_name):
    path = os.environ['PATH']
    for d in path.split(os.pathsep):
        file_path = os.path.abspath(os.path.join(d, file_name))
        if os.path.exists(file_path):
            return '"%s"' % file_path
    return '"%s"' % file_name


if __name__ == '__main__':
    parser = OptionParser()
    parser.add_option('-d', '--debug', action="store_true",
                      help="Run app using pudb debugger.")
    parser.add_option('-c', '--clear', action='store_true',
                       help="Empty the data store before start.")
    (options, args) = parser.parse_args()
    command = ['python2.5']
    if options.debug:
        command.append('-m ' + DEBUG_MODULE)
    command.extend((find_in_path('dev_appserver.py'),
                    '-a pageforest --show_mail_body --use_sqlite'))
    if options.clear:
        command.append('--clear_datastore')
    command.extend(sys.argv[1:])
    command = ' '.join(command)
    if 'HOME' in os.environ:
        store_dir = os.path.join(os.environ['HOME'], 'dev_appserver.datastore')
        command += ' --datastore_path %s' % store_dir
    command += ' ' + pftool.app_dir
    print(command)
    code = os.system(command)
    sys.exit(code)
