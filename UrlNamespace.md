# Definitions #

  * _app_ - The application identifier (` [a-z][a-z0-9-]*[a-z0-9] `)
  * _doc_ - A document identifier (` ([a-zA-Z0-9_-][a-zA-Z0-9_\.-]* `)
  * _user_ - A username (same as allowed document identifiers).
  * _meta_ - The application identifier of a _meta application_.
  * _key_ - Allow any characters allowed in a url, including slashes.  Note that meta application keys but must not begin with '.'.

# Pageforest Applications #

Applications can read and write two distinct namespaces of data:

  * Meta-data - shared across all document instances (e.g., "static" resources and files for the application).
  * Document-data - per-document instance data

| **URL Pattern**                         | **Description** |
|:----------------------------------------|:----------------|
| _app_.pageforest.com/                   | Application home page - same as /index.html |
| _app_.pageforest.com/app.json           | Meta-data for the application (JSON) |
| admin._app_.pageforest.com/             | Used by pf.py to write an apps static files |
| _app_.pageforest.com/_key_              | Key-value storage for application static resources |
| _app_.pageforest.com/index.html         | Application home page |
| _app_.pageforest.com/docs/_doc_         | Saved document data (JSON) |
| _app_.pageforest.com/docs/_doc_/_key_   | Key-value storage for document - _key_ may contain slashes |
| _app_.pageforest.com/#_doc_             | Application home page - bound to a document instance |
| _app_.pageforest.com#_doc_              | Saved document  - prettier but will re-write to above |

HTTP methods GET, PUT and POST(?) are supported for all documents and blob requests.

## Reserved names in the application key space ##

  * docs - Saved document resources rooted here.
  * app.json - application meta-data
  * lib - Mirror of pageforest javascript libraries.
  * static - Mirror of pageforest static resources (js, css, images).
  * .key - All keys beginning with '.' are reserved.
  * Reserved for use by pageforest: meta, data, auth, oauth, stats

# Meta-Applications #

Some pageforest applications are "meta-applications" in that they are designed to edit other
applications (applications whose documents are themselves other pageforest applications).
One of these is called "editor.pageforest.com", but 3rd parties can write other meta apps
(you must get permission from the Pageforest admins to elevate your app to be a meta application).

| _meta_.pageforest.com/mirror/         | Returns all app.json objects for all apps writable by the current user |
|:--------------------------------------|:-----------------------------------------------------------------------|
| _meta_.pageforest.com/mirror/_app_/   | Mirror of the application static document storage                      |

# www.pageforest.com #

| **URL Pattern**       | **Description** |
|:----------------------|:----------------|
| /                     | Pageforest home page |
| /static/              | Static js, css, and images used by pageforest.com |
| /lib/                 | Official javascript library release e.g., /.lib/1.0/crypto.min.js |
| /docs/                | Document library contents for the current user |
| /apps/                | Application Directory |
| /apps/_app_/          | Application details page |