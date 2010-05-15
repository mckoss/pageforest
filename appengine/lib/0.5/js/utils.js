/* Begin file: namespace.js */
/* Namespace.js

   Version 2.0, May 11, 2010
   by Mike Koss - released into the public domain.

   Support for building modular namespaces in javascript.

   Globals:

   namespace - The top of the namespace hierarchy. Child
   namespaces are stored as properties in each namespace object.

   namespace.lookup(path) - Return the namespace object with the given
   path. Creates the namespace if it does not already exist. The path
   has the form ('unique.module.sub_module').

   Utility functions:

   util = namespace.util;

   util.extendObject(dest, source1, source2, ...) - Copy the properties
   from the sources into the destination (properties in following objects
   override those from the preceding objects).

   util.copyArray(a) - makes a (shallow) copy of an array or arguments list
   and returns an Array object.

   Extensions to the Function object:

   Class.methods({
   f1: function () {...},
   f2: function () {...}
   ));

   f1.fnMethod(obj, args) - closure to call obj.f1(args);

   f1.fnArgs(args) - closure to add more arguments to a function

   *** Class Namespace ***

   Methods:

   ns.define(callback(ns)) - Call the provided function with the new
   namespace as a parameter. Returns the newly defined namespace.

   ns.defineOnce(callback(ns)) - Same as 'define', but only allows the
   first invocation of the callback function.

   ns.extend(object) - Copy the (own) properties of the source
   object into the namespace.

   ns.nameOf(symbol) - Return the global name of a symbol in a namespace
   (for eval() or html onEvent attributes).

   Usage example:

   namespace.lookup('org.startpad.base').define(function(ns) {
       var util = namespace.util;
       var other = ns.lookup('org.startpad.other');

       ns.extend({
           var1: value1,
           var2: value2,
           myFunc: function(args) {
               ...other.aFunction(args)...
           }
       });

       // Constructor
       ns.ClassName = function(args) {
           ...
       };

       util.extendObject(ns.ClassName.prototype, {
           var1: value1,

           method1: function(args) {
           }
       });
   });
*/

// Define stubs for FireBug objects if not present.
// This is here because this will often be the first javascript file loaded.
// We refrain from using the window object as we may be in a web worker where
// the global scope is NOT window.
try {
    var console = (function() {
        if (console != undefined) {
            return console;
        }
        var noop = function() {};
        var names = ["log", "debug", "info", "warn", "error", "assert",
                     "dir", "dirxml", "group", "groupEnd", "time", "timeEnd",
                     "count", "trace", "profile", "profileEnd"];
        var consoleT = {};
        for (var i = 0; i < names.length; ++i) {
            consoleT[names[i]] = noop;
        }
        return consoleT;
    }());
}
catch (e) {}

var namespace = (function() {
    try {
        if (namespace != undefined) {
            return namespace;
        }
    }
    catch (e) {}

    function Namespace(parent, name) {
        if (name) {
            name = name.replace(/-/g, '_');
        }
        this._isDefined = false;
        this._parent = parent;
        if (this._parent) {
            this._parent[name] = this;
            this._path = this._parent._path;
            if (this._path !== '') {
                this._path += '.';
            }
            this._path += name;
        } else {
            this._path = '';
        }
    }

    var namespaceT = new Namespace(null);

    // Extend an object's properties from one (or more) additional
    // objects.
    function extendObject(dest, args) {
        if (dest === undefined) {
            dest = {};
        }
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            for (var prop in source) {
                if (source.hasOwnProperty(prop)) {
                    dest[prop] = source[prop];
                }
            }
        }
        return dest;
    }

    // Useful for converting arguments to an regular array
    function copyArray(arg) {
        return Array.prototype.slice.call(arg, 0);
    }

    // Inspired by JavaScript: The Good Parts, p33.
    // Usage:
    // Class.methods({
    // f1: function() {...},
    // f2: function() {...}
    // });
    Function.prototype.methods = function (obj) {
        extendObject(this.prototype, obj);
    };

    Function.methods({
        // Closure for a method call - like protoype.bind()
        fnMethod: function (obj) {
            var _fn = this;
            return function() {
                return _fn.apply(obj, arguments);
            };
        },

        // Closure with appended parameters to the function call.
        fnArgs: function () {
            var _fn = this;
            var _args = copyArray(arguments);

            return function() {
                var args = copyArray(arguments).concat(_args);
                // REVIEW: Is this intermediate self variable needed?
                var self = this;
                return _fn.apply(self, args);
            };
        }
    });

    // Functions added to every Namespace.
    Namespace.methods({
        // Call a function with the namespace as a parameter - forming
        // a closure for the namespace definition.
        define: function(callback) {
            this._isDefined = true;
            console.info("Namespace '" + this._path + "' defined.");
            if (callback) {
                callback(this);
            }
            return this;
        },

        // Same as define, but will not execute the callback more than once.
        defineOnce: function(callback) {
            // In case a namespace is multiply loaded, we ignore the
            // definition function for all but the first call.
            if (this._isDefined) {
                console.warn("WARNING: Namespace '" + this._path +
                             "' redefinition.");
                return this;
            }
            return this.define(callback);
        },

        // Extend the namespace from the arguments of this function.
        extend: function() {
            // Use the Array.slice function to convert arguments to a
            // real array.
            var args = [this].concat(copyArray(arguments));
            return extendObject.apply(undefined, args);
        },

        // Return a global name for a namespace symbol (for eval()
        // or use in onEvent html attributes.
        nameOf: function(symbol) {
            symbol = symbol.replace(/-/g, '_');
            return 'namespace.' + this._sPath + '.' + symbol;
        }
    });

    extendObject(namespaceT, {
        // Lookup a global namespace object, creating it (and it's parents)
        // as necessary.
        lookup: function(path) {
            path = path.replace(/-/g, '_');
            var parts = path.split('.');
            var cur = namespaceT;
            for (var i = 0; i < parts.length; i++) {
                var name = parts[i];
                if (cur[name] === undefined) {
                    cur = new Namespace(cur, name);
                }
                else {
                    cur = cur[name];
                }
            }
            return cur;
        }
    });

    // Put utilities in the 'util' namespace beneath the root.
    namespaceT.lookup('util').extend({
        extendObject: extendObject,
        copyArray: copyArray
    }).defineOnce();

    return namespaceT;
}());
/* Begin file: base.js */
namespace.lookup('org.startpad.base').defineOnce(function(ns) {
    var util = namespace.util;

    /* Javascript Enumeration - build an object whose properties are
       mapped to successive integers. Also allow setting specific values
       by passing integers instead of strings. e.g. new ns.Enum("a", "b",
       "c", 5, "d") -> {a:0, b:1, c:2, d:5}
    */
    function Enum(args) {
        var j = 0;
        for (var i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] == "string") {
                this[arguments[i]] = j++;
            }
            else {
                j = arguments[i];
            }
        }
    }

    Enum.methods({
        // Get the name of a enumerated value.
        getName: function(value) {
            for (var prop in this) {
                if (this.hasOwnProperty(prop)) {
                    if (this[prop] == value)
                        return prop;
                }
            }
        }
    });

    // Fast string concatenation buffer
    function StBuf() {
        this.rgst = [];
        this.append.apply(this, arguments);
    }

    StBuf.methods({
        append: function() {
            for (var ist = 0; ist < arguments.length; ist++) {
                this.rgst.push(arguments[ist].toString());
            }
            return this;
        },

        clear: function() {
            this.rgst = [];
        },

        toString: function() {
            return this.rgst.join("");
        }
    });

    ns.extend({
        extendObject: util.extendObject,
        Enum: Enum,
        StBuf: StBuf,

        extendIfMissing: function(oDest, var_args) {
            if (oDest == undefined) {
                oDest = {};
            }
            for (var i = 1; i < arguments.length; i++) {
                var oSource = arguments[i];
                for (var prop in oSource) {
                    if (oSource.hasOwnProperty(prop) &&
                        oDest[prop] == undefined) {
                        oDest[prop] = oSource[prop];
                    }
                }
            }
            return oDest;
        },

        // Deep copy properties in turn into dest object
        extendDeep: function(dest) {
            for (var i = 1; i < arguments.length; i++) {
                var src = arguments[i];
                for (var prop in src) {
                    if (src.hasOwnProperty(prop)) {
                        if (src[prop] instanceof Array) {
                            dest[prop] = [];
                            ns.extendDeep(dest[prop], src[prop]);
                        }
                        else if (src[prop] instanceof Object) {
                            dest[prop] = {};
                            ns.extendDeep(dest[prop], src[prop]);
                        }
                        else {
                            dest[prop] = src[prop];
                        }
                    }
                }
            }
        },

        randomInt: function(n) {
            return Math.floor(Math.random() * n);
        },

        strip: function(s) {
            return (s || "").replace(/^\s+|\s+$/g, "");
        },

        /* Return new object with just the listed properties "projected"
         into the new object */
        project: function(obj, asProps) {
            var objT = {};
            for (var i = 0; i < asProps.length; i++) {
                objT[asProps[i]] = obj[asProps[i]];
            }
            return objT;
        },

        /* Sort elements and remove duplicates from array (modified in place) */
        uniqueArray: function(a) {
            if (!a) {
                return;
            }
            a.sort();
            for (var i = 1; i < a.length; i++) {
                if (a[i - 1] == a[i]) {
                    a.splice(i, 1);
                }
            }
        },

        map: function(a, fn) {
            var aRes = [];
            for (var i = 0; i < a.length; i++) {
                aRes.push(fn(a[i]));
            }
            return aRes;
        },

        filter: function(a, fn) {
            var aRes = [];
            for (var i = 0; i < a.length; i++) {
                if (fn(a[i])) {
                    aRes.push(a[i]);
                }
            }
            return aRes;
        },

        reduce: function(a, fn) {
            if (a.length < 2) {
                return a[0];
            }
            var res = a[0];
            for (var i = 1; i < a.length - 1; i++) {
                res = fn(res, a[i]);
            }
            return res;
        }
    });


}); // startpad.base
/* Begin file: misc.js */
namespace.lookup("com.pageforest.misc").define(function(ns) {

    ns.strip = function(s) {
        return (s || "").replace(/^\s+|\s+$/g, "");
    };

});
/* Begin file: random.js */
namespace.lookup("com.pageforest.random").defineOnce(function(ns) {

    ns.upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    ns.lower = 'abcdefghijklmnopqrstuvwxyz';
    ns.digits = '0123456789';
    ns.base64 = ns.upper + ns.lower + ns.digits + '+/';
    ns.base64url = ns.upper + ns.lower + ns.digits + '-_';
    ns.hexdigits = ns.digits + 'abcdef';

    ns.random = function(len, chars) {
        if (typeof chars == 'undefined') {
            chars = ns.base64url;
        }
        var radix = chars.length;
        var result = [];
        for (var i = 0; i < len; i++) {
            result[i] = chars[0 | Math.random() * radix];
        }
        return result.join('');
    };

}); // com.pageforest.random
/* Begin file: cookies.js */
namespace.lookup('com.pageforest.cookies').define(function(ns) {
    /*
    Client-side cookie reader and writing helper.

    Cookies can be quoted with "..." if they have spaces or other
    special characters. Internal quotes may be escaped with a \
    character These routines use encodeURIComponent to safely encode
    and decode all special characters.
    */
    var misc = namespace.lookup('com.pageforest.misc');

    ns.extend({
    setCookie: function(name, value, days, path) {
        var expires = '';
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            expires = '; expires=' + date.toGMTString();
        }
        path = '; path=' + (path || '/');
        document.cookie =
            encodeURIComponent(name) + '=' + encodeURIComponent(value)
            + expires + path;
    },

    getCookie: function(name) {
        return ns.getCookies()[name];
    },

    getCookies: function(name) {
        var st = document.cookie;
        var rgPairs = st.split(";");

        var obj = {};
        for (var i = 0; i < rgPairs.length; i++) {
            // document.cookie never returns ;max-age, ;secure, etc. - just name value pairs
            rgPairs[i] = misc.strip(rgPairs[i]);
            var rgC = rgPairs[i].split("=");
            var val = decodeURIComponent(rgC[1]);
            // Remove quotes around value string if any (and also replaces \" with ")
            var rg = val.match('^"(.*)"$');
            if (rg)
                val = rg[1].replace('\\"', '"');
            obj[decodeURIComponent(rgC[0])] = val;
        }
        return obj;

    }}); // ns

}); // com.pageforest.cookies
/* Begin file: client.js */
/*
  client.js - Pageforest client api for sign in, save, load, and url
  management.

  Requires jQuery.

  TODO: This client assumes the app is hosted at appid.pageforest.com.
  It needs to be modified to support remote hosting and local filesystem
  testing.
 */
namespace.lookup('com.pageforest.client').defineOnce(function (ns) {
    var cookies = namespace.lookup('com.pageforest.cookies');
    var base = namespace.lookup('org.startpad.base');

    // TODO: Add alert if jQuery is not present.

    var pollInterval = 500;

    // The application calls Client, and implements the following methods:
    // app.loaded(jsonDocument) - Called when a new document is loaded
    // app.saved() - successfully saved
    // app.error(errorMessage) - Called when we get an error reading or
    //     writing a document (optional).
    // app.userChanged(username) - Called when the user signs in or signs out
    //     ('anonymous').
    function Client(app) {
        this.app = app;

        // TODO: Support remote and local filesytem hosting.
        this.appHost = location.host;
        var dot = this.appHost.indexOf('.');
        this.appid = this.appHost.substr(0, dot);
        this.wwwHost = 'www' + this.appHost.substr(dot);

        this.lastHash = '';
        this.state = Client.states.clean;
        this.username = undefined;
        this.fLogging = false;

        // REVIEW: When we support multiple clients per page, we can
        // combine all the poll functions into a shared one.
        setInterval(this.poll.fnMethod(this), pollInterval);

        // Catch window unload if the user tries to close an unsaved window
        $(window).bind('beforeunload', this.beforeUnload.fnMethod(this));
    }

    Client.states = new base.Enum('clean', 'dirty', 'loading', 'saving');

    Client.methods({
        // Load a document
        load: function (docid) {
            // REVIEW: What to do if already in loading or saving state?
            this.state = Client.states.loading;
            this.docid = docid;
            this.log("load: " + this.docid);
            $.ajax({
                dataType: 'json',
                url: 'http://' + this.appHost + '/docs/' + docid,
                error: this.errorHandler.fnMethod(this),
                success: function (document, textStatus, xmlhttp) {
                    this.state = Client.states.clean;
                    this.app.loaded(document);
                }.fnMethod(this)
            });
        },

        save: function (json, docid) {
            if (this.username == undefined) {
                this.errorReport('no_username', "You must sign in to save.");
            }
            if (docid != undefined) {
                this.docid = docid;
            }

            // First save - assign docid like username_random
            if (this.docid == undefined) {
                this.docid = this.username + '_' + base.randomInt(1000);
            }

            this.state = Client.states.saving;

            // TODO: If this is a first save, generate a default docid
            // using username_N pattern.
            if (!json.readers) {
                json.readers = ['public'];
            }
            var data = JSON.stringify(json);
            this.log('save: ' + this.docid, json);
            $.ajax({
                type: 'PUT',
                url: '/docs/' + this.docid,
                data: data,
                error: this.errorHandler.fnMethod(this),
                success: function(data) {
                    this.log('saved');
                    location.hash = this.docid;
                    // Don't trigger a load after we just saved.
                    this.lastHash = location.hash;
                    this.state = Client.states.clean;
                    if (this.app.saved) {
                        this.app.saved();
                    }
                }.fnMethod(this)
            });
        },

        setLogging: function(f) {
            f = (f == undefined) ? true : f;
            this.fLogging = f;
        },

        log: function(message, obj) {
            if (this.fLogging) {
                // BUG: console.log.apply(undefined, arguments) work in Chrome!
                if (obj != undefined) {
                    console.log(message, obj);
                }
                else {
                    console.log(message);
                }
            }
        },

        errorHandler: function (xmlhttp, textStatus, errorThrown) {
            var code = 'ajax_error/' + xmlhttp.status;
            var message = xmlhttp.statusText;
            this.log(message + ' (' + code + ')', xmlhttp);
            this.errorReport(code, xmlhttp.statusText);
        },

        errorReport: function(status, message) {
            if (this.app.error) {
                this.app.error(status, message);
            }
            else {
                alert(status + ': ' + message);
            }
        },

        makeDirty: function(fDirty) {
            if (fDirty == undefined) {
                fDirty = true;
            }
            // REVIEW: What if we are loading or saving? Does this
            // canel a load?
            this.state = fDirty ? Client.states.dirty : Client.states.clean;
        },

        // The user is about to close the page - we want to alert the
        // user if he might lose changes.
        beforeUnload: function(evt) {
            if (this.state != Client.states.clean) {
                evt.returnValue = "You will lose your changes if you leave " +
                    "the window without saving.";
                return evt.returnValue;
            }
        },

        // Periodically poll for changes in the URL and state of user sign-in
        // Could start loading a new document
        // TODO: If the document is dirty, we don't want to overwrite it
        // without getting permission?
        poll: function () {
            if (this.lastHash != location.hash) {
                this.lastHash = location.hash;
                this.load(location.hash.substr(1));
            }
            this.checkUsername();
        },

        // See if the user sign-in state has changed by polling the cookie
        // TODO: Need to do a JSONP call to get the username if not hosting
        // on appid.pageforest.com.
        checkUsername: function () {
            var sessionkey = cookies.getCookie('sessionkey');
            var usernameLast = this.username;

            if (sessionkey !== undefined) {
                this.username = sessionkey.split('/')[1];
            }
            else {
                this.username = undefined;
            }
            if (this.app.userChanged && usernameLast != this.username) {
                this.log('found user: ' + this.username);
                this.app.userChanged(this.username || 'anonymous');
            }
        },

        // Direct the user to the Pageforest sign-in page.
        signIn: function () {
            window.open('http://' + this.wwwHost + "/sign-in/scratch/",
                        '_blank');
        },

        // Expire the session key to remove the sign-in for the user.
        signOut: function () {
            // checkUsername will update the user state in a jiffy
            document.cookie = 'sessionkey=expired; path=/; expires=' +
                'Sat, 01 Jan 2000 00:00:00 GMT';
        }

    });

    // Exports
    ns.extend({
        Client: Client
    });

});
