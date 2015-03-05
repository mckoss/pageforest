# appengine/manage.py test #

This is Django's standard unit test framework. It requires the django\_appengine module from http://code.google.com/p/google-app-engine-django/ somewhere on your PYTHON\_PATH.

The doctests for simple python modules in appengine/utils are also integrated in the unit test framework.

# pylint.py #

This is a portable configuration and filter script to run pylint on the appengine directory.

Any arguments will be passed to pylint, which is useful for running ` pylint.py -e ` to report only hard errors, not convention, refactor or warning messages.

# whitespace.py #

This script detects all of the following invisible problems:

  * Trailing whitespace.
  * Tabs in source code.
  * CRLF instead of LF.
  * Missing newline at the end of file.
  * Blank lines at the end of file.

# check.py #

This script runs all of the above tests, with stderr redirected to check.log to prevent clobbering your precommit output. If any check fails, it aborts and explains.

# Mercurial precommit hook #

Add the following in your ` pageforest/.hg/hgrc ` file to run the test suite before you commit:

```
[hooks]
precommit = ~/src/pageforest/check.py
```