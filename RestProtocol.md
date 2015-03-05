# REST Interface #

The lowest level protocol for Pageforest is a [REST](http://en.wikipedia.org/wiki/Representational_State_Transfer) interface to create,
read, and write _documents_ and _blobs_.  Most apps will not have to program to the REST
protocol directly, but rather will call functions in the [Client Library](ClientLibrary.md).

You can use the standard HTTP methods (GET, PUT, HEAD, LIST, DELETE) to access any
_blob_ or _document_. When your application is hosted on a pageforest.com domain
(myapp.pageforest.com), you can use the browser support for XMLHttpRequest (AJAX) to
implement these verbs (subject to the [same origin](http://en.wikipedia.org/wiki/Same_origin_policy) policy of the web browser.

We recommend using [jQuery.ajax()](http://api.jquery.com/jQuery.ajax/) as an easy
way to implement reading and writing to Pageforest storage.

## Saving a JSON blob into a document using jQuery ##

```
var data = {
    title: "My Document",
    readers: ["public"]
    blob: {stuff: "Internal App Data"},
};
$.ajax({
    type: "PUT",
    url: "/docs/mydoc",
    data: JSON.stringify(data),
    success: function(data) {
        alert("Document saved.");
    }
});
```

## Loading a document using jQuery ##

```
$.ajax({
    url: "/docs/mydoc",
    success: function(document) {
        alert("Loaded " + document.title);
    }
});
```

If you are hosting your application on your own domain, you can still access your
application data via a JSONP (cross-site) interface (currently only GET is supported,
later POST will be as well).  To do so, add a _callback_ and _method_ parameter (defaults
to _GET_) like so:

> http://myapp.pageforest.com/docs/mydoc?callback=foo

# HTTP Methods #

All Pageforest methods use standard or extended HTTP methods (i.e., a [REST-ful](http://en.wikipedia.org/wiki/Representational_State_Transfer) interface).

We have added some extension to allow for methods that are not natively supported in the browser, or to enable techniques like JSONP
callbacks.  Extensions are implemented as additional query parameters in the URL.

| **Parameter** | **Description** |
|:--------------|:----------------|
| callback      | Set equal to a JavaScript function you want to call when used as a [JSONP](http://en.wikipedia.org/wiki/JSON#JSONP) function:<br><code>&lt;script src="http://scratch.pageforest.com/docs/test-1?callback=MyFunction"&gt;</code> <br>
<tr><td> method        </td><td> Used to replace the currently used HTTP verb (usually GET), with a different, possibly extended method. </td></tr></tbody></table>

<h1>GET Method #

Resources saved in Pageforest are retrieved using a standard HTTP GET method.

| **Parameter** | **Description** |
|:--------------|:----------------|
| wait          | Number of seconds the response can be deferred IFF the underlying data has not changed.  Currently, requests of up to 30 seconds are supported. Use the wait parameter if you would like to be notified when a _Blob_ you you have previously read has been modified from the last known value.  Note: Uses request header HTTP\_IF\_NONE\_MATCH to tell the server the ETag of the last known value. |

_Documents_ always return a JSON formatted object like the following:

http://scratch.pageforest.com/docs/test-1

```
{
  "blob": {
    "testArray": [
      1,
      2,
      3
    ],
    "testBool": false,
    "testNum": 1,
    "testObj": {
      "a": 1,
      "b": 2
    },
    "testString": "hello"
  },
  "created": {
    "__class__": "Date",
    "isoformat": "2010-11-15T22:04:19.750722Z"
  },
  "doc_id": "test-1",
  "modified": {
    "__class__": "Date",
    "isoformat": "2010-11-17T18:17:31.226832Z"
  },
  "owner": "mckoss",
  "readers": [
    "public"
  ],
  "tags": [],
  "title": "A testing document.",
  "writers": []
}
```

_Blobs_ can be returned as JSON objects OR any other Internet-compatible datatype (text, image, etc.).

# PUT Method #

A standard PUT method is used to write a _Document_ or _Blob_ resource.

| **Parameter** | **Description** |
|:--------------|:----------------|
| transfer-encoding=base64 | Allow the data to be passed as base64 encoding, instead of default of utf-8.  This is useful if you want to construct image data in the client. |
| tags          | Comma separated list of _tags_ to annotate the blob.  Blobs can be queried by tag, in addition to their key names (see the LIST method, below).  |

# DELETE Method #

Remove a _Document_ or _Blob_ from the data store.

| **Parameter** | **Description** |
|:--------------|:----------------|
| method=delete | Delete the referenced _Blob_ or _Document_.  |

# PUSH Method #

The PUSH method allows the client to append a json fragment to the end
of a (json-formatted) _Blob_.  Note that the Blob must be formatted as a json array at the top level.

| **Parameter** | **Description** |
|:--------------|:----------------|
| method=push   | Push a json fragment to the end of an existing Blob (if a blob does not exist, it will be created).  |
| max           | (default 100).  A value between 0 and 1000.  If the number of elements in the array exceeds the max, the array will be trimmed so that only the last _max_ elements will be retained. |

# SLICE Method #

Return a range of values from a json-array formatted _Blob_.

| **Parameter** | **Description** |
|:--------------|:----------------|
| method=slice  | Returns [start:end] elements from the _Blob_. |
| start         | (default 0) Index of the first element to return. |
| end           | (default - length of array) Index of the element _beyond_ the last element to be returned. |
| wait          | Number of seconds the response can be deferred IFF the underlying data has not changed.  Currently, requests of up to 30 seconds are supported. Use the wait parameter if you would like to be notified when a slice you you have previously read has been modified from the last known value.  Note: Uses request header HTTP\_IF\_NONE\_MATCH to tell the server the ETag of the last known value. |

# LIST Method #

The LIST method returns keys and meta-data for a collection of _Documents_ or _Blobs_.

| **Parameter** | **Description** |
|:--------------|:----------------|
| method=list   | Return a JSON object containing collections of _Documents_ or _Blobs_ |
| depth         | (default = 1) can be 0 (all levels), 1 (first level), 2 (first two levels), etc. based on the depth of the key space (one fewer than the number of slashes in the key name) |
| keysonly      | (default false) Set to 'true' to return just the keys for all matching blobs - not the meta-data. |
| prefix        | Matches the prefix of the key string of any blob. |
| tag           | Filter only results that have the given tag |
| limit         | Limit the number of results to return. |
| order         | Return the ordering by a specified property.  Currently order=modified (ascending) and order=-modified (descending) are the only allowed orderings. |
| cursor        | If there are more results available than the limit allows, a cursor property will be returned.  This value van be passed in as a parameter to get the next group of results in the list. |
| since         | Provide a date (in ISO 8601 format) to restrict the items to be only those modified **after** the given date/time. (blobs only for now) |

The JSON results will include an _items_ property with a dictionary of key/value pairs for each object.  If an order clause
is present, an _order_ property will contain a list of keys in order to the requested sort.  A _cursor_ propert is given
if there are additional results that can be retrieved.

_Note that only Blob LIST commands support depth, prefix, and order parameters._

TODO: Should 'tag' be 'tags'?

_Examples:_

http://scratch.pageforest:8080/docs/?method=list - return list of all documents in this app owned by the logged in user.
<br><a href='http://scratch.pageforest:8080/docs/test-storage?method=list'>http://scratch.pageforest:8080/docs/test-storage?method=list</a> - return a list of all <i>Blobs</i> in a document.<br>
<br>
LIST returns a JSON formatted object like:<br>
<br>
<pre><code>{<br>
  "mckoss-3157": {<br>
    "json": true,<br>
    "modified": {<br>
      "__class__": "Date",<br>
      "isoformat": "2010-11-17T18:25:32.259048Z"<br>
    },<br>
    "sha1": "b899ba14dce9d5083a62f1aec2b4b4a27dff519d",<br>
    "size": 25<br>
  },<br>
  "mckoss-5097": {<br>
    "json": true,<br>
    "modified": {<br>
      "__class__": "Date",<br>
      "isoformat": "2010-11-17T18:02:45.988785Z"<br>
    },<br>
    "sha1": "3d6e057cbadfef055c5641426e2df1ef7937beb3",<br>
    "size": 58<br>
  },<br>
...<br>
}<br>
</code></pre>