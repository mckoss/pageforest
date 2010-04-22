#!/usr/bin/env python

import os
import sys

import pftool

if __name__ == '__main__':
    command = 'dev_appserver.py -a pageforest -p 80 --clear_datastore ' +\
        pftool.app_dir
    print(command)
    code = os.system(command)
    sys.exit(code)