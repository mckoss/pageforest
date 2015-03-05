# 2011-03-15 v0.7.0 #

  1. pf.py now fully unit tested
  1. some changes to hash codes generated for documents

# 2011-02-28 #

  1. Support 'pf manifest' command to create an auto-updated application manifest.

# 2011-02-24 #

  1. App-specific user accounts
  1. Add secureData field to app.json - require SSL connection for all data access (must use appspot domain).

# 2011-02-08 #

  1. Increase number of Features Apps to 100 on main page.

# 2011-01-28 #

  1. Smaller App Bar on mobile displays.

# 2011-01-23 #

  1. Change default document URL to slugified(title).
  1. Remember docid when navigating to as-yet created document.
  1. (Hack) to allow saving a "doc" to a "blob" in a document - used in wiki.pageforest.com.

# 2011-01-15 #

  1. Changed app-bar to be fixed instead of absolute positioned.

# 2011-01-13 #

  1. Fixed [Issue 70](https://code.google.com/p/pageforest/issues/detail?id=70) - warning if documet is about to unload while dirty.
  1. Feature [Issue 71](https://code.google.com/p/pageforest/issues/detail?id=71) - anonymous channel subscriptions
  1. Fixed [Issue 72](https://code.google.com/p/pageforest/issues/detail?id=72) - 404 pages not working with JSONP requests
  1. Fixed app cloning from web page - broken for last 2 weeks!  :-(

# 2011-01-10 #

  1. list:since implemented
  1. fix bug in initial sha1 hash of app.json file.
  1. fix bug in detecting if use is currently signed in to application from /sign-in page

# 2011-01-07 #

  1. storage.subscribe() now supports 'children' option - letting you receive notifications on all child blobs within a document.
  1. cookie usersession set on verify - enables apps to directly sign-in on their own domain.
  1. 'order' options added to storage.list function

# 2011-01-04 #

  1. pf.py supports deleting applications

# 2010-12-22 #

  1. pf.py options added
  1. pf.py default encode file uploads using base64
  1. sha1 hash computation code cleanup
  1. app.json now includes modified, created, sha1, and size (ignored on upload)

# 2010-12-20 #

  1. Support for method=list&order=modified and '-modified'.
  1. Fixed bug in editor not reading the LIST format.
  1. sha1 and size added to documents and apps
  1. html5 doctype in scratch sample

# 2010-12-14 #

  1. Doc and App delete working (server side)
  1. /docs?method=list&keysonly=true working

# 2010-12-11 #

  1. pf.py delete supported