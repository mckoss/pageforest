#!/usr/bin/env python

import os
import sys

import pftool

if __name__ == '__main__':
    command = 'java org.mozilla.javascript.tools.shell.Main beautify-cl.js'
    command += ' -i 4 ' + ' '.join(sys.argv[1:])
    print("Command: %s" % command)
    os.chdir(pftool.tools_dir)
    code = os.system(command)
    sys.exit(code)
