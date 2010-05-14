#!/usr/bin/env python

import os
import sys

import pftool

DEBUG = False

if DEBUG:
    RHINO = 'java org.mozilla.javascript.tools.debugger.Main'
else:
    RHINO = 'java org.mozilla.javascript.tools.shell.Main'

if __name__ == '__main__':
    command = RHINO + ' '
    command += os.path.join(pftool.js_test_dir, 'test-runner-cl.js')
    command += ' ' + ' '.join(sys.argv[1:])
    print command
    os.chdir(pftool.js_test_dir)
    code = os.system(command)
    sys.exit(code)
