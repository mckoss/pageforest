# Introduction #

Pageforest is a web service for JavaScript applications.  We wanted a way to build complete web applications in JavaScript, and to only have to be concerned with writing client code.  The Pageforest server, implements a common [Storage](StorageLibrary.md) interface so your application does not have to implement server-side storage or user management.

# Design Goals #

We are targetting these design goals:

  * Be able to write a complete web application using only client-side JavaScript, HTML, and CSS.
  * Applications can be hosted on any (static) web hosting platform.
  * Provide simple-to-use static application hosting directly on the Pageforest.com domain.
  * Give users an online storage location for their saved application data.
  * Make single-page/document-based web applications particularly simple to implement.
  * Application data can be saved and loaded from an application by loading from and saving to a simple JSON-encodable JavaScript object.
  * Give users the control of grant (or deny) access to their storage to selected applications.
  * Securely authenticate users and applications, so that each are only allowed access to storage to which they have be specifically admitted.
  * Use standard internet protocols ([REST-API](RestProtocol.md)) for read and write data to Pageforest storage.
  * Enable developers to sell their applications to end-users or share in Pageforest.com revenue from end-users.

# How does it work? #

The basic unit of storage in a Pageforest application is a _document_.  Applications can use AJAX calls to read and write (JSON-formatted) documents to storage.  Each document is owned by a particular Pageforest user, so the application must be [authenticated](http://code.google.com/docreader/#p=pageforest&s=pageforest&t=Permissions) by the user and allowed to access his or her storage.

Each document can also contain multiple _Blobs_.  A Blob can contain any Internet datatype (JSON, Text, PNG/JPEG/GIF Images, PDF, CSS, HTML, etc.).  Blobs inherit the permissions of their parent document.  Applications can use AJAX or JSONP API's to access Blobs.

When your application is first loaded, the URL can indicate that a particular document is to be loaded (by use of an #anchor at the end of the URL).  This initiates a GET to the Pageforest data store api.  If a document is found, it is then passed to your application (in JSON format).  Similarly, when you are ready to save your document, you initiate a PUT request to the Pageforest server, passing a JSON-formatted blob to be saved.

The mechanics of saving and loading, and keeping track of the document state, are handled by the [Client Library](ClientLibrary.md).

# How much does it cost? #

Pageforest is free to application developers.  At present, it is also free for all Pageforest end-users.  Ultimately, we will charge users to store data beyond a free quota amount or for premium services or support.  Our intention is to make Pageforest a platform where developers can earn money from their web applications.

# How do I develop a Pageforest application? #

Pageforest applications can be very simple - any web page is a valid Pageforest application.  The best way to get started is to make a copy of our ["Scratch" application](GettingStarted.md).  This tutorial will walk you through the steps of making a very simple Pageforest app that can save and load the contents of a Title and Body field on a simple web form.