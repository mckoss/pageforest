#!/usr/bin/env python

import os
import sys
from optparse import OptionParser, make_option

import pftool

RHINO = 'java org.mozilla.javascript.tools.shell.Main'
RHINO_DEBUG = 'java org.mozilla.javascript.tools.debugger.Main'

if __name__ == '__main__':
    option_list = (
        make_option('-q', '--quiet', action='store_true',
                    help="just display error summary"),
        make_option('-a', '--all', action='store_true',
                    help="run all (applicable) tests"),
        make_option('-d', '--debug', action='store_true',
                    help="run rhino debugger over tests"),
        )
    parser = OptionParser(option_list=option_list,
        usage="%prog [options] module_names")
    (options, args) = parser.parse_args()
    command = options.debug and RHINO_DEBUG or RHINO
    command += ' ' + os.path.join(pftool.js_test_dir, 'test-runner-cl.js')
    if options.quiet:
        command += ' -q'
    if options.all:
        command += ' -a'
    command += ' ' + ' '.join(args)
    os.chdir(pftool.js_test_dir)
    code = os.system(command)
    sys.exit(code)
