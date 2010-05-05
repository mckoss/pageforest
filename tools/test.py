#!/usr/bin/env python

import os
import sys

import pftool

if __name__ == '__main__':
    command = 'start dev_appserver.py -a pageforest -p 80 ' + \
        '--clear_datastore --show_mail_body ' + pftool.app_dir
    print(command)
    code = os.system(command)
    sys.exit(code)
