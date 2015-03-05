# Table of Contents #



# Introduction #

Pageforest is a web application development service for JavaScript
applications.  Using Pageforest, you'll be able to write a fully functional
web application, without having to create any server-side components.
Pageforest will provide your application with these services:

  * **Document Storage** - Store data created by your application securely in the cloud.
  * **User Authentication** - Users can sign-in to your application, allowing them secure access to documents your application creates on their behalf.
  * **Application Hosting** - You can host your web application on the pageforest.com domain (e.g., http://scratch.pageforest.com/).

# Pageforest Concepts #

## Applications ##

A Pageforest application consists of static files which contain your
user interface and program code. An application can be composed of
multiple files to organize your application content (like an index.html for your
home page, a CSS file describing your page formatting, an images directory
holding your graphical images for your interface, and one or more JavaScript
files containing your code).

You can build your application just as you would any other static web site.
Pageforest provides interfaces for user authentication and data storage.

For each application you create, you will be assigned your own application sub-domain like:

> http://myapp.pageforest.com/

All static files for your application will be accessible through this domain.  For example:

<ul type='none'>
<li><a href='http://myapp.pageforest.com/index.html'>http://myapp.pageforest.com/index.html</a></li>
<li><a href='http://myapp.pageforest.com/style.css'>http://myapp.pageforest.com/style.css</a></li>
<li><a href='http://myapp.pageforest.com/main.js'>http://myapp.pageforest.com/main.js</a></li>
<li>etc.</li>
</ul>

_Note: You can also host your code on any static web server using your own domain name.  The documents for your application will still be hosted on the pageforest sub-domain (see below)._

## Documents ##

The basic unit of storage on Pageforest is the _document_. Each document has
its own URL that you can GET or PUT using a [REST API](RestProtocol.md).

Each document can be accessed with requests to the _/docs_ URL in your application.  For example:

<ul type='none'>
<li><a href='http://myapp.pageforest.com/docs/mydoc'>http://myapp.pageforest.com/docs/mydoc</a></li>
<li><a href='http://myapp.pageforest.com/docs/123'>http://myapp.pageforest.com/docs/123</a></li>
</ul>

Because all documents your application creates share the same /docs/ prefix, you may want to choose document identifiers that include the name of the user that created it so users don't inadvertently create document URL's with the same name.  For example:

> http://myapp.pageforest.com/docs/username-id

Note that document IDs can contain letters, numbers, hyphens, underscores and periods
(but NOT slashes - see Blobs below).

Note that your users need never see the document URL's directly.  This is because your application is loaded from its application home page (typically, http://myapp.pageforest.com/index.html - or just, http://myapp.pageforest.com/).  Pageforest applications then append an anchor (e.g., #username-id) to the URL to indicate which document to load into the current application:

> http://myapp.pageforest.com/#username-id


## Blobs ##

While most simple applications can store all of their state in the top-level
_document_, a more complex application can write to an arbitrary number
of _blobs_ associated with each _document_. Blob URL's begin with
the document URL and are appended with a _key string_ (which _may_ contain slashes) to
identify blobs associated with the _document_:

<ul type='none'>
<li><a href='http://myapp.pageforest.com/docs/mydoc/key/name/with/slashes'>http://myapp.pageforest.com/docs/mydoc/key/name/with/slashes</a></li>
</ul>

A blob can contain almost any type of information; e.g., text, JSON, PDF, XML, or images (PNG, GIF, JPG).

# Creating Your First Application #

The best way to learn how to build a Pageforest application is to copy (clone) our sample application,
[scratch.pageforest.com](http://scratch.pageforest.com).  This tutorial demonstrates how to:

  * Create a pageforest application.
  * Edit the static files that make up your application.
  * Use the [Client Library](ClientLibrary.md) to save and load documents from your application.

<a href='http://www.youtube.com/watch?feature=player_embedded&v=T5pfopKTnD8' target='_blank'><img src='http://img.youtube.com/vi/T5pfopKTnD8/0.jpg' width='640' height=505 /></a>

## Setup ##

You should first [create a Pageforest account](http://www.pageforest.com/sign-up) so you can use Pageforest applications and save documents to your online Pageforest data store.

You can play with the scratch application to get an idea of what it can do.

> ![http://wiki.pageforest.googlecode.com/hg/images/scratch.png](http://wiki.pageforest.googlecode.com/hg/images/scratch.png)

  * Visit http://scratch.pageforest.com.
  * Click the Sign-In button to grant permissions to the scratch application to save documents on your behalf.
  * Modify the title and body text on the web form.
  * Click Save.

You'll note that once you save a document, the URL in the address bar changes from:

> http://scratch.pageforest.com/

to something like:

> http://scratch.pageforest.com/#mckoss-my-document-6692

It's instructive to see how the underlying document is saved as JSON in Pageforest.  Click the link titled:

> [JSON data for this document](http://scratch.pageforest.com/docs/mckoss-my-document-6692/?callback=document)

to view the raw JSON file in your browser (you may have to download the file and view in a text editor, depending on the browser that you are using).

## Clone the Sample Application ##

As an application author, you can allow others to _clone_ your application, so other developers can extend your application and modify it for themselves.  To clone the [scratch](http://scratch.pageforest.com) application:

  * Visit the [application details page](http://www.pageforest.com/apps/scratch).
  * Click the [clone this app](http://www.pageforest.com/apps/scratch/clone/) link (if you don't see the link you may not be [signed in](http://www.pageforest.com/sign-in/), or you have already created your full quota of applications).
  * Choose your own appid, title, etc.  In the _writers_ field, you can list the user names of others whom you want to have access to modify your application (leave it blank if you want to be the only author).
  * Click _Create New App_.

Your application is now deployed on Pageforest's servers.  You should be able to go to your application home page, sign in, and save documents using your new app.

## Modifying Your Application ##

There are two ways to edit your Pageforest application:

  1. Use the online [Code Editor](http://editor.pageforest.com)
  1. Download the app deployment utility - [PFPY](PFPY.md).

# A Walk-Through of the Sample Application #

The scratch application represents a very simple pageforest application, with the following features:

  * The user can change the title and body field.
  * A Pageforest Sign-in/Sign-out button.
  * Save to and load from a Pageforest document.
  * Allows the user to make a copy of a previously saved document.

You're encouraged to [browse the source](http://code.google.com/p/pageforest/source/browse/#hg/examples/scratch) of the scratch application.

In _index.html_, you'll find the _home page_ of our application.  You'll note that we load some standard libraries and our application code from main.js:

```
<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.min.js"></script>
<script type="text/javascript" src="/lib/0.6/js/json2.min.js"></script>
<script type="text/javascript" src="/lib/beta/js/utils.js"></script>
<script type="text/javascript" src="main.js"></script>
<script type="text/javascript">
var scratch = namespace.lookup("com.pageforest.scratch");
$(document).ready(scratch.onReady);
</script>
```

As well as some buttons and form fields:

```
<input type="button" id="signin" onclick="scratch.signInOut()" value="Sign in" />
...
<input type="text" id="title" name="title" value="My Document" />
...
<textarea id="blob" name="blob">You can store a text blob in each document.</textarea>
...
<input type="button" onclick="scratch.client.detach();" value="Make a Copy" />
...
<input id="save" type="button" onclick="scratch.client.save();" value="Save" />
```

We use [jQuery](http://jquery.com/) to run our application's _onReady()_ function when the page loads.  Open up [main.js](http://code.google.com/p/pageforest/source/browse/examples/scratch/main.js) to see the JavaScript code for this application.

The first two lines define a JavaScript [namespace](NameSpace.md) (called "com.pageforest.scratch") which holds our application code, and imports the namespace of the Pageforest [Client Library](ClientLibrary.md):

```
namespace.lookup('com.pageforest.scratch').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
```

The onReady function set's the input focus to the title form field, and registers our application (here, called "ns"), with the Client Library.  The Client Library will take care of reading and writing our document from Pageforest, and call callback functions in our application to notify us about events
(like document load and save events).

```
    function onReady() {
        $('#title').focus();
        ns.client = new clientLib.Client(ns);
        ns.client.setLogging(true);
        // Quick call to poll - don't wait a whole second to try loading
        // the doc and logging in the user.
        ns.client.poll();
    }
```

The Client Library requires that your application implement a setDoc() function and a getDoc() function in order for it to manage your document loading and saving:

```
    // This function is called whenever your document should be reloaded.
    function setDoc(json) {
        $('#title').val(json.title);
        $('#blob').val(json.blob);
    }

    // Convert your current state to JSON with title and blob properties,
    // these will then be saved to pageforest's storage.
    function getDoc() {
        return {
            "title": $('#title').val(),
            "blob": $('#blob').val(),
            "readers": ["public"]
        };
    }
```

In our case, we simply use jQuery to read and write from the html form fields (called _title_, and _blob_).  The setDoc function is passed a [JavaScript Object for your document](http://scratch.pageforest.com/docs/mckoss-my-document-6692/?callback=document).  Your getDoc() function should return a JavaScript Object, that contains at least a _title_ and a _blob_ field.

You'll note that in this sample, our _blob_ is a simple text string - but it could contain a large JSON-formatted object (up to 1 Megabyte in size!).

The other functions in our sample receive events when the state of the document changes (loaded, saved), or when a user signs in or out.

The lines of code at the bottom of _main.js_, simply make sure that our functions are set as properties of our _ns_ application object:

```
    // Exported functions
    ns.extend({
        onReady: onReady,
        getDoc: getDoc,
        setDoc: setDoc,
        onError: onError,
        onUserChange: onUserChange,
        onStateChange: onStateChange,
        signInOut: signInOut
    });
```

## Suggested Modifications ##

You might want to try the following exercises:

  * Add additional form fields to _index.html_ and add them to your document _blob_.
  * Display the form fields as read-only text fields (` <div> `'s) unless the user is signed in _and_ is a writer or owner of the document.
  * Save a history of all edits to the document by writing a _blob_ each time the document is saved.  Display a revision history and allow your users to revert the document to a past revision.