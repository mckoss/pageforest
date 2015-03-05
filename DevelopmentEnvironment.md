You can execute the script [pfsetup](http://pageforest.googlecode.com/hg/tools/pfsetup) on your Ubuntu machine to install the required programs for PageForest server development.

# Installation #

If you are manually configuring your machine, here are some instructions:

  * [Python 2.5.2](http://www.python.org/download/releases/2.5.2/)
    * (Windows) Be sure to add .PY to your PATHEXT.
    * If you having trouble with python command line arguments not being passed to python command scripts, see [this stackoverflow solution](http://stackoverflow.com/questions/2640971/windows-is-not-passing-command-line-arguments-to-python-programs-executed-from-th).
  * [Java runtime](http://www.java.com/en/download/manual.jsp)
  * [Rhino](http://www.mozilla.org/rhino/download.html) (for build-time javascript execution):
    * (Windows) Potentially, we could use Windows Script Host to run JavaScript natively?
    * Unzip and place rhino1\_7R2/js.jar in your CLASSPATH.
  * django 1.1...
  * appengine\_helper...
    * This version of manage.py requires App Engine Helper:
    * http://code.google.com/p/google-app-engine-django/
    * Copy the appengine\_django folder somewhere in sys.path, but not in this application directory, because we don't want to deploy it to App Engine for the production system.
    * The following files should be removed because they're broken or take a long time during every unit test run:
      * appengine\_django/tests/commands\_test.py
      * appengine\_django/tests/integration\_test.py
      * appengine\_django/tests/serialization\_test.py
  * _Need section on setting up Hudson - test server_
  * [pylint](http://pypi.python.org/pypi/pylint) - Note that version 0.21 seems to cause runtime exceptions.  Installing version 0.22 fixes it.


  * easy\_install mock
  * easy\_install pep8
  * Note: We have seen some installations complain about a missing ipaddr module.  We can't reproduce this now...

We need to patch a bug in Django 1.1 (for versions older than 1.1.4) to run ` manage.py test ` with HTTP PUT requests. Change line 371 in django/test/client.py (inside the ` put ` method):

```
--- django/test/client.py	(revision 13020)
+++ django/test/client.py	(working copy)
@@ -367,7 +367,7 @@
             'CONTENT_LENGTH': len(post_data),
             'CONTENT_TYPE':   content_type,
             'PATH_INFO':      urllib.unquote(parsed[2]),
-            'QUERY_STRING':   urlencode(data, doseq=True) or parsed[4],
+            'QUERY_STRING':   parsed[4],
             'REQUEST_METHOD': 'PUT',
             'wsgi.input':     FakePayload(post_data),
         }
```

# Notes #

Unfortunately, appengine helper, does sys.path fixups but ONLY if google.appengine is NOT in the sys.path to begin with!