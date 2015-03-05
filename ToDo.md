# pageforest.com (mike) #

  * X Migrate templates from old pageforest project
  * X deploy to test.pageforest.com
  * X build on deploy
  * / - home page - simplified positioning and offer
    * Add graphics for callouts.
  * X /about-us
  * X /terms-of-service
  * /user/user\_id - user profile
  * /app/app\_id - application info page
  * /embed - page with installation instructions to get widget.js
  * /user/user\_id/apps - developer page - list of applications
  * /user/user\_id/docs - list of documents saved by user
  * /apps - application gallery
  * /apps/app\_id - Application info page
  * Design tweaks
    * remove gray background
    * bolder pageforest.com font
    * larger font sizes throughout
    * make tabs prettier
  * X Wildcard domain support (dyndns):
    * \ **.pageforest.com
    ***.pgfrst.com - purchased - need to set DNS
  * X www.pageforest.com going to new application
    * redirect naked domain to www.
  * Use png throughout
    * resolve color (gamma) problems on mac
  * Layout zoom level bugs
    * Save widget
    * tabs
    * Get the Code text
  * favicon
    * include larger formats for iphone/ipad
  * Sign-in and sign-out UI
  * X Build non-minified js for developer reference and debugging.
  * breadcrumbs
  * style single-column page

# Build environment #

  * X run all javascript through jslint
  * X pfdeploy.py - upload directory to meta.pageforest.com

# Client JavaScript code (mike) #

  * Talk about version numbers, e.g. www.pageforest.com/lib/0.8.1/widget.js
  * remove base.js, events.js - use jQuery instead?
  * Unit tests working for needed files:
  * X (1) jslint weak and strong modes
  * (2) jsbeautify - for code formatting
  * (1)New account UI.
    * Page redirection with polling option
    * Remove option (and docs) for client-API authentication - security hole
  * Save widget
  * Factor startpad.data
    * Async callbacks (use jquery)
    * XSS layer on top
  * Documentation page for explosed js api (jsdoc?).

# Datastore API (johann) #

  * read/write document meta data
  * access control for readers and writers

# Tests and samples (mike) #

  * Migrate pfsamples to use the new pageforest.com.
  * X Migrate unittest framework. (mike)
  * migrate tests for
    * all
    * timer
    * data
    * simple-sample
    * vector
    * state-machine?
  * integrate js unit tests with build

# Post-1.0 ToDo's (backlog) #

  * Move registration script to app directory (not at top level?)
    * Would need to expose for raw development source too via middleware
  * Run jslint from wsh instead of Rhino?
    * http://www.jslint.com/wsh/index.html
  * Make Closure compiler compatible (jsdoc - static checking)
  * Performance optimization
    * Create a wrapper around memcache using request.cache to avoid network latency and serializer overhead if the same entity is read more than once during the same HTTP request.