#!/usr/bin/env python

import os
import sys

import pftool

if __name__ == '__main__':
    command = ('dev_appserver.py -a pageforest ' + \
        '--show_mail_body %s') % ' '.join(sys.argv[1:])
    if 'HOME' in os.environ:
        store_dir = os.path.join(os.environ['HOME'], 'dev_appserver.datastore')
        command += ' --datastore_path %s' % store_dir
    command += ' ' + pftool.app_dir
    print(command)
    code = os.system(command)
    sys.exit(code)
