#!/usr/bin/env python

import os
import sys

from check import attempt

DISABLE_MESSAGES = """
C0121 Missing required attribute "__revision__"
E1101 Class 'KeyValue' has no 'get_by_key_name' member
E1103 Instance of 'KeyValue' has no 'put' member (but some types ...
F0401 Unable to import 'django.test' (No module named django)
R0903 Too few public methods (0/2)
W0142 Used * or ** magic
W0232 Class has no __init__ method
"""

disable_msg = []
for line in DISABLE_MESSAGES.splitlines():
    parts = line.split()
    if parts and len(parts[0]) == 5 and parts[0][1:].isdigit():
        disable_msg.append(parts[0])

options = sys.argv[1:]
options.append('--disable-msg=' + ','.join(disable_msg))
path = os.path.dirname(__file__) or '.'
attempt('pylint %s %s/appengine' % (' '.join(options), path))
