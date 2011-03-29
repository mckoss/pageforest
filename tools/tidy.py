#!/usr/bin/env python

import os
import sys
import re
import tempfile
from time import time
import subprocess
from optparse import OptionParser

import pftool

LINE_COLUMN_REGEX = re.compile(r'line (\d+) column (\d+) - (.+)')
DJANGO_TAG_REGEX = re.compile(r'{%.+?%}')
DJANGO_VAR_REGEX = re.compile(r'{{.+?}}')

DOCTYPE_LINE = ' '.join("""
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
""".split())

TEMP_FILENAME = os.path.join(tempfile.gettempdir(), 'tidy.html')

IGNORE_MESSAGES = """
""".strip().splitlines()


def ignore(line):
    for message in IGNORE_MESSAGES:
        if message.rstrip() in line:
            return True


def exec_and_filter(command, filename, options):
    if options.verbose:
        print command
    proc = subprocess.Popen(command, shell=True,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT)
    stdout, stderr = proc.communicate()
    # Filter error messages and count errors.
    errors = 0
    for line in stdout.splitlines():
        match = LINE_COLUMN_REGEX.match(line)
        if not match:
            print "no match:", line.rstrip()
            continue
        line, column, message = match.groups()
        print '%s:%s:%s: %s' % (filename, line, column, message)
        errors += 1
    return errors


def replace_django_tag(match):
    return ' ' * len(match.group(0))


def replace_django_var(match):
    return 'x' * len(match.group(0))


def generate_tempfile(filename):
    """
    Generate temp file without Django tags.
    """
    input = open(filename).read()
    lines = input.splitlines()
    # Add doctype header etc. if necessary.
    if '<body' not in input:
        lines[0] = '<body>' + lines[0]
        lines.append('</body>')
    if '<head' not in input:
        lines[0] = '<head><title></title></head>' + lines[0]
    if '<!DOCTYPE' not in input:
        lines[0] = DOCTYPE_LINE + lines[0]

    # Create temp file without Django tags.
    outfile = open(TEMP_FILENAME, 'w')
    for line in lines:
        line = DJANGO_TAG_REGEX.sub(replace_django_tag, line)
        line = DJANGO_VAR_REGEX.sub(replace_django_var, line)
        outfile.write(line + '\n')
    outfile.close()


def main():
    parser = OptionParser(
        usage="%prog [options] module_or_package")
    parser.add_option('-v', '--verbose', action='store_true')
    parser.add_option('-f', '--force', action='store_true',
                      help="Force/fast - full check of all files.")
    (options, args) = parser.parse_args()

    if len(args) < 1:
        args.append('.')

    command = ['tidy', '-e', '-q', '-utf8', '-xml', TEMP_FILENAME]

    walk = pftool.FileWalker(matches=('*.html',), pass_key='tidy')
    if options.force:
        walk.pass_key = None

    file_count = 0
    total_errors = 0
    start = time()

    dirty_files = list(walk.walk_files(*args))
    file_count = len(dirty_files)

    command = ' '.join(command)
    for filename in dirty_files:
        generate_tempfile(filename)
        errors = exec_and_filter(command, filename, options)
        if errors == 0:
            walk.set_passing(pass_key='tidy', file_path=filename)
        total_errors += errors
    if os.path.exists(TEMP_FILENAME):
        # print "Deleting", TEMP_FILENAME
        os.unlink(TEMP_FILENAME)

    walk.save_pass_dict()

    elapsed = time() - start

    if total_errors or (options.verbose and file_count > 0):
        sys.exit(('Found %d errors in %d files ' +
                 '(in %1.1f seconds ... %1.1f secs per file).') %
                 (total_errors, file_count,
                  elapsed, elapsed / file_count))


if __name__ == '__main__':
    main()
