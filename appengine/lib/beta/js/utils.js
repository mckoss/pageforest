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
if (typeof console == 'undefined') {
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
        // List of namespaces that were referenced during definition.
        this._referenced = [];
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
                Namespace.defining = this;
                callback(this);
                Namespace.defining = undefined;
            }
            return this;
        },

        // Same as define, but will not execute the callback more than once.
        defineOnce: function(callback) {
            // In case a namespace is multiply loaded, we ignore the
            // definition function for all but the first call.
            if (this._isDefined) {
                console.warn("Namespace '" + this._path + "' redefinition.");
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
            return 'namespace.' + this._path + '.' + symbol;
        }
    });

    extendObject(namespaceT, {
        // Lookup a global namespace object, creating it (and it's parents)
        // as necessary.  If a namespace is currently being defined,
        // add any looked up references to the namespace (if lookup is not
        // used, _referenced will not be complete.
        lookup: function(path) {
            var fCreated = false;
            path = path.replace(/-/g, '_');
            var parts = path.split('.');
            var cur = namespaceT;
            for (var i = 0; i < parts.length; i++) {
                var name = parts[i];
                if (cur[name] === undefined) {
                    cur = new Namespace(cur, name);
                    fCreated = true;
                }
                else {
                    cur = cur[name];
                }
            }
            if (Namespace.defining) {
                Namespace.defining._referenced.push(cur);
                if (fCreated) {
                    console.warn("Forward reference from " +
                                 Namespace.defining._path + " to " +
                                 path + ".");
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
                    if (this[prop] == value) {
                        return prop;
                    }
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

    function extendIfMissing(oDest, var_args) {
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
    }

    // Deep copy properties in turn into dest object
    function extendDeep(dest) {
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
    }

    function randomInt(n) {
        return Math.floor(Math.random() * n);
    }

    function strip(s) {
        return (s || "").replace(/^\s+|\s+$/g, "");
    }

    /* Return new object with just the listed properties "projected"
       into the new object */
    function project(obj, asProps) {
        var objT = {};
        for (var i = 0; i < asProps.length; i++) {
            objT[asProps[i]] = obj[asProps[i]];
        }
        return objT;
    }

    function keys(map) {
        var list = [];

        for (var prop in map) {
            if (map.hasOwnProperty(prop)) {
                list.push(prop);
            }
        }
        return list;
    }

    /* Sort elements and remove duplicates from array (modified in place) */
    function uniqueArray(a) {
        if (!a) {
            return;
        }
        a.sort();
        for (var i = 1; i < a.length; i++) {
            if (a[i - 1] == a[i]) {
                a.splice(i, 1);
            }
        }
    }

    function map(a, fn) {
        var aRes = [];
        for (var i = 0; i < a.length; i++) {
            aRes.push(fn(a[i]));
        }
        return aRes;
    }

    function filter(a, fn) {
        var aRes = [];
        for (var i = 0; i < a.length; i++) {
            if (fn(a[i])) {
                aRes.push(a[i]);
            }
        }
        return aRes;
    }

    function reduce(a, fn) {
        if (a.length < 2) {
            return a[0];
        }
        var res = a[0];
        for (var i = 1; i < a.length - 1; i++) {
            res = fn(res, a[i]);
        }
        return res;
    }

    ns.extend({
        extendObject: util.extendObject,
        Enum: Enum,
        StBuf: StBuf,

        'extendIfMissing': extendIfMissing,
        'extendDeep': extendDeep,
        'randomInt': randomInt,
        'strip': strip,
        'project': project,
        'uniqueArray': uniqueArray,
        'map': map,
        'filter': filter,
        'reduce': reduce,
        'keys': keys
    });



}); // startpad.base
/* Begin file: random.js */
namespace.lookup("com.pageforest.random").defineOnce(function(ns) {

    ns.upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    ns.lower = 'abcdefghijklmnopqrstuvwxyz';
    ns.digits = '0123456789';
    ns.base64 = ns.upper + ns.lower + ns.digits + '+/';
    ns.base64url = ns.upper + ns.lower + ns.digits + '-_';
    ns.hexdigits = ns.digits + 'abcdef';

    ns.randomString = function(len, chars) {
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
namespace.lookup('org.startpad.cookies').define(function(ns) {
    /*
    Client-side cookie reader and writing helper.

    Cookies can be quoted with "..." if they have spaces or other
    special characters. Internal quotes may be escaped with a \
    character These routines use encodeURIComponent to safely encode
    and decode all special characters.
    */
    var base = namespace.lookup('org.startpad.base');

    function setCookie(name, value, days, path) {
        var expires = '';
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            expires = '; expires=' + date.toGMTString();
        }
        path = '; path=' + (path || '/');
        document.cookie = encodeURIComponent(name) + '=' +
            encodeURIComponent(value) + expires + path;
    }

    function getCookie(name) {
        return ns.getCookies()[name];
    }

    function getCookies(name) {
        var st = document.cookie;
        var rgPairs = st.split(";");

        var obj = {};
        for (var i = 0; i < rgPairs.length; i++) {
            // document.cookie never returns ;max-age, ;secure, etc. -
            // just name value pairs
            rgPairs[i] = base.strip(rgPairs[i]);
            var rgC = rgPairs[i].split("=");
            var val = decodeURIComponent(rgC[1]);
            // Remove quotes around value string if any (and also
            // replaces \" with ")
            var rg = val.match('^"(.*)"$');
            if (rg) {
                val = rg[1].replace('\\"', '"');
            }
            obj[decodeURIComponent(rgC[0])] = val;
        }
        return obj;
    }


    // Exports
    ns.extend({
        setCookie: setCookie,
        getCookie: getCookie,
        getCookies: getCookies
    });

}); // org.startpad.cookies
/* Begin file: format.js */
namespace.lookup('org.startpad.format').defineOnce(function(ns) {
    var base = namespace.lookup('org.startpad.base');

    // Thousands separator
    var comma = ',';

    // Return an integer as a string using a fixed number of digits,
    // (require a sign if fSign).
    function fixedDigits(value, digits, fSign) {
        var s = "";
        var fNeg = (value < 0);
        if (digits == undefined) {
            digits = 0;
        }
        if (fNeg) {
            value = -value;
        }
        value = Math.floor(value);

        for (; digits > 0; digits--) {
            s = (value % 10) + s;
            value = Math.floor(value / 10);
        }

        if (fSign || fNeg) {
            s = (fNeg ? "-" : "+") + s;
        }

        return s;
    }

    // Return integer as string with thousand separators with optional
    // decimal digits.
    function thousands(value, digits) {
        var integerPart = Math.floor(value);
        var s = value.toString();
        var sLast = "";
        while (s != sLast) {
            sLast = s;
            s = s.replace(/(\d+)(\d{3})/, "$1" + comma + "$2");
        }

        var fractionString = "";
        if (digits && digits > 0) {
            var fraction = value - integerPart;
            fraction = Math.floor(fraction * Math.pow(10, digits));
            fractionString = "." + fixedDigits(fraction, digits);
        }
        return s + fractionString;
    }

    // Converts to lowercase, removes non-alpha chars and converts
    // spaces to hyphens
    function slugify(s) {
        s = base.strip(s).toLowerCase();
        s = s.replace(/[^a-zA-Z0-9]/g, '-').
              replace(/[\-]+/g, '-').
              replace(/(^-+)|(-+$)/g, '');
        return s;
    }

    function escapeHTML(s) {
        s = s.toString();
        s = s.replace(/&/g, '&amp;');
        s = s.replace(/</g, '&lt;');
        s = s.replace(/>/g, '&gt;');
        s = s.replace(/\"/g, '&quot;');
        s = s.replace(/'/g, '&#39;');
        return s;
    }

    // Replace all instances of pattern, with replacement in string.
    function replaceString(string, pattern, replacement) {
        var output = "";
        if (replacement == undefined) {
            replacement = "";
        }
        else {
            replacement = replacement.toString();
        }
        var ich = 0;
        var ichFind = string.indexOf(pattern, 0);
        while (ichFind >= 0) {
            output += string.substring(ich, ichFind) + replacement;
            ich = ichFind + pattern.length;
            ichFind = string.indexOf(pattern, ich);
        }
        output += string.substring(ich);
        return output;
    }

    // Replace keys in dictionary of for {key} in the text string.
    function replaceKeys(st, keys) {
        for (var key in keys) {
            if (keys.hasOwnProperty(key)) {
                st = replaceString(st, "{" + key + "}", keys[key]);
            }
        }
        // remove unused keys
        st = st.replace(/\{[^\{\}]*\}/g, "");
        return st;
    }

    ns.extend({
        fixedDigits: fixedDigits,
        thousands: thousands,
        slugify: slugify,
        escapeHTML: escapeHTML,
        replaceKeys: replaceKeys,
        replaceString: replaceString
    });
}); // org.startpad.format
/* Begin file: client.js */
/*
  client.js - Pageforest client api for sign in, save, load, and url
  management.

  Requires jQuery.

  TODO: This client assumes the app is hosted at appid.pageforest.com.
  It needs to be modified to support remote hosting and local filesystem
  testing.
 */

/*global jQuery $ */
namespace.lookup('com.pageforest.client').defineOnce(function (ns) {
    var cookies = namespace.lookup('org.startpad.cookies');
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');

    ns.pollInterval = 1000;

    // Error messages
    var discardMessage = "You will lose your document changes if you continue.";
    var jQueryMessage = "jQuery must be installed to use this library.";
    var signInMessage = "You must sign in to save a document.";
    var unloadMessage = "You will lose your changes if you leave " +
        "the document without saving.";
    var objectMessage = "Document data is missing.";
    var titleMessage = "Document is missing a title.";
    var blobMessage = "Document is missing a blob property.";

    // The application calls Client, and implements the following methods:
    // app.setDoc(jsonDocument) - Called when a new document is loaded.
    // app.getDoc() - Called to get the json data to be saved.
    // app.onSaveSuccess() - successfully saved.
    // app.onError(errorMessage) - Called when we get an error reading or
    //     writing a document (optional).
    // app.onUserChange(username) - Called when the user signs in or signs out
    // app.onStateChange(new, old) - Notify app about current state changes.
    function Client(app) {
        if (typeof $ != 'function' || $ != jQuery) {
            this.errorReport('jQuery_required', jQueryMessage);
            return;
        }

        this.app = app;

        this.appHost = location.host;
        var dot = this.appHost.indexOf('.');
        this.appid = this.appHost.substr(0, dot);
        this.wwwHost = 'www' + this.appHost.substr(dot);

        this.state = 'clean';
        this.username = undefined;
        this.fLogging = true;

        // Auto save every 60 seconds
        this.saveInterval = 60;

        // Map deprecated function names.
        var deprecated = {
            "getData": "getDoc",
            "setData": "setDoc"
        };
        for (var oldName in deprecated) {
            if (deprecated.hasOwnProperty(oldName)) {
                var newName = deprecated[oldName];
                if (app[oldName] && !app[newName]) {
                    this.log("deprecated function " + oldName +
                             " should be renamed to " + newName,
                             {'level': 'warn'});
                    app[newName] = app[oldName];
                }
            }
        }

        // REVIEW:
        this.setCleanDoc(undefined, true);

        // REVIEW: When we support multiple clients per page, we can
        // combine all the poll functions into a shared one.
        // Note that we cannot kick off a poll() until this constructor
        // returns as the app's callbacks likely depend on completing their
        // initialization.
        setInterval(this.poll.fnMethod(this), ns.pollInterval);

        // Catch window unload if the user tries to close an unsaved window
        $(window).bind('beforeunload', this.beforeUnload.fnMethod(this));
    }

    Client.methods({
        // Load a document
        load: function (docid) {
            // Your data is on notice.
            if (this.isDirty()) {
                if (!this.confirmDiscard()) {
                    return;
                }
                // Your data is dead to me.
                this.changeState('clean');
            }

            // REVIEW: What to do about race condition if already
            // loading or saving?
            this.stateSave = this.state;
            this.changeState('loading');

            this.log("loading: " + docid);
            $.ajax({
                dataType: 'json',
                url: this.getDocURL(docid),
                error: this.errorHandler.fnMethod(this),
                success: function (document, textStatus, xmlhttp) {
                    this.app.setDoc(document);
                    this.setCleanDoc(docid);
                }.fnMethod(this)
            });
        },

        save: function (json, docid) {
            if (this.username == undefined) {
                this.errorReport('no_username', signInMessage);
                return;
            }

            if (json == undefined) {
                json = this.app.getDoc();
                if (typeof json != 'object') {
                    this.errorReport('missing_object', objectMessage);
                    return;
                }
                if (json.title == undefined) {
                    this.errorReport('missing_title', titleMessage);
                    return;
                }
                if (json.blob == undefined) {
                    this.errorReport('missing_blob', blobMessage);
                    return;
                }
            }

            if (docid == undefined) {
                docid = this.docid;
            }

            // First save?  Assign docid like username-slug
            // FIXME: We could over-write a previously existing document
            // with the same name.  We should do one of:
            // - Check for existence first
            // - Ask the server for a unique docid
            // - Add some randomness to the docid
            // - Use PUT if_not_exists
            if (docid == undefined) {
                docid = this.username + '-' + json.title + '-' +
                    base.randomInt(10000);
                docid = format.slugify(docid);
            }

            this.stateSave = this.state;
            this.changeState('saving');

            // Default permissions to be public readable.
            if (!json.readers) {
                json.readers = ['public'];
            }

            var data = JSON.stringify(json);
            this.log('saving: ' + this.getDocURL(docid), {'obj': json});
            $.ajax({
                type: 'PUT',
                url: this.getDocURL(docid),
                data: data,
                error: this.errorHandler.fnMethod(this),
                success: function(data) {
                    this.setCleanDoc(docid);
                    this.log('saved');
                    if (this.app.onSaveSuccess) {
                        this.app.onSaveSuccess();
                    }
                }.fnMethod(this)
            });
        },

        // Detach the current document from it's storage.
        detach: function() {
            this.setCleanDoc();
            this.setDirty();
        },

        // Set the document to the clean state.
        // If docid is undefined, set to the "new" document state.
        // If preserveHash, we don't modify the URL
        setCleanDoc: function(docid, preserveHash) {
            this.docid = docid;
            this.changeState('clean');
            // Remember the clean state of the document
            this.lastJSON = JSON.stringify(this.app.getDoc());

            // Enable polling to kick off a load().
            if (preserveHash) {
                this.lastHash = '';
                return;
            }

            if (docid == undefined) {
                docid = '';
            }

            location.hash = docid;
            this.lastHash = location.hash;
            // Chrome has a bug where the location bar is not updated unless
            // the whole thing is set.
            location.href = location.href;
        },

        getDocURL: function(docid) {
            if (docid == undefined) {
                docid = this.docid;
            }
            if (docid == undefined) {
                return undefined;
            }
            return 'http://' + this.appHost + '/docs/' + docid + '/';
        },

        setLogging: function(f) {
            f = (f == undefined) ? true : f;
            this.fLogging = f;
        },

        log: function(message, options) {
            if (!this.fLogging) {
                return;
            }
            if (options == undefined) {
                options = {};
            }
            if (!options.hasOwnProperty('level')) {
                options.level = 'log';
            }
            if (options.hasOwnProperty('obj')) {
                console[options.level](message, options.obj);
            } else {
                console[options.level](message);
            }
        },

        errorHandler: function (xmlhttp, textStatus, errorThrown) {
            this.changeState(this.stateSave);
            var code = 'ajax_error/' + xmlhttp.status;
            var message = xmlhttp.statusText;
            this.log(message + ' (' + code + ')', {'obj': xmlhttp});
            this.errorReport(code, message);
        },

        errorReport: function(status, message) {
            if (this.app.onError) {
                this.app.onError(status, message);
            }
            else {
                var formatted = "client error: " + message +
                    ' (' + status + ')';
                console.log(formatted);
            }
        },

        confirmDiscard: function() {
            if (this.app.confirmDiscard) {
                return this.app.confirmDiscard();
            }
            return confirm(discardMessage);
        },

        setDirty: function(fDirty) {
            if (fDirty == undefined) {
                fDirty = true;
            }

            // Save the first dirty time
            if (!this.isDirty() && fDirty) {
                this.dirtyTime = new Date().getTime();
            }

            // REVIEW: What if we are loading or saving? Does this
            // cancel a load?
            this.changeState(fDirty ? 'dirty' : 'clean');
        },

        isDirty: function() {
            return this.state == 'dirty';
        },

        isSaved: function() {
            return this.state == 'clean' && this.docid != undefined;
        },

        changeState: function(state) {
            if (state == this.state) {
                return;
            }

            var stateOld = this.state;
            this.state = state;

            if (this.app.onStateChange) {
                this.app.onStateChange(state, stateOld);
            }
        },

        // The user is about to navigate away from the page - we want to
        // alert the user if he might lose changes.
        beforeUnload: function(evt) {
            if (this.state != 'clean') {
                evt.returnValue = unloadMessage;
                return evt.returnValue;
            }
        },

        // Periodically poll for changes in the URL and state of user sign-in
        // Could start loading a new document
        poll: function () {
            if (this.lastHash != location.hash) {
                this.lastHash = location.hash;
                this.load(location.hash.substr(1));
            }
            this.checkUsername();
            this.checkDoc();
        },

        // See if the user sign-in state has changed by polling the cookie
        // TODO: Need to do a JSONP call to get the username if not hosting
        // on appid.pageforest.com.
        checkUsername: function () {
            var sessionUser = cookies.getCookie('sessionuser');
            var usernameLast = this.username;

            if (sessionUser != undefined) {
                if (sessionUser != this.username) {
                    this.username = sessionUser;
                    this.log('signed in as ' + this.username);
                    if (this.app.onUserChange) {
                        this.app.onUserChange(this.username);
                    }
                }
            } else {
                if (this.username) {
                    this.username = undefined;
                    if (this.app.onUserChange) {
                        this.app.onUserChange(this.username);
                    }
                }
            }
        },

        // See if the document data has changed - assume this is not
        // expensive as we execute this every second.
        checkDoc: function() {
            // No auto-saving - do nothing
            if (this.saveInterval == 0) {
                return;
            }

            // See if it's time to do an auto-save
            if (this.isDirty()) {
                if (this.username == undefined) {
                    return;
                }
                var now = new Date().getTime();
                if (now - this.dirtyTime > this.saveInterval * 1000) {
                    this.save();
                }
                return;
            }

            // Don't do anything if we're saving or loading.
            if (this.state != 'clean') {
                return;
            }

            // Document looks clean - see if it's changed since we last
            // checked.
            var json = JSON.stringify(this.app.getDoc());
            if (json != this.lastJSON) {
                this.setDirty();
            }
        },

        // Direct the user to the Pageforest sign-in page.
        signIn: function () {
            window.open('http://' + this.wwwHost + '/sign-in/' +
                        this.appid + '/', '_blank');
        },

        // Expire the session key to remove the sign-in for the user.
        signOut: function () {
            // checkUsername will update the user state in a jiffy
            cookies.setCookie('sessionuser', 'expired', -1);
            cookies.setCookie('sessionkey', 'expired', -1);

            // Some browsers don't allow writing to HttpOnly cookies -
            // use the server to do it.
            $.ajax({
                dataType: 'text',
                url: 'http://' + this.appHost + '/auth/set-session/expired/',
                error: this.errorHandler.fnMethod(this),
                success: function (sessionKey, textStatus, xmlhttp) {
                    this.log("sessionkey deleted");
                }.fnMethod(this)
            });
        }

    });

    // Exports
    ns.extend({
        Client: Client
    });

});
