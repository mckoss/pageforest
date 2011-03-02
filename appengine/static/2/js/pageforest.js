/* Begin file: namespace.js */
/* Namespace.js

   Version 2.1, Sept. 14, 2010
   by Mike Koss - released into the public domain.

   Support for building modular namespaces in javascript.

   Globals:

   namespace - The top of the namespace hierarchy. Child
   namespaces are stored as properties in each namespace object.

   namespace.lookup(path) - Return the namespace object with the given
   path. Creates the namespace if it does not already exist. The path
   has the form (unique.module.sub_module, e.g., 'com.pageforest.sample').

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

// Note: IE8 will NOT have console defined until the page loads under
// the debugger.  I haven't been able to get the IE8 console working EVER.
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
    // 1 - info, 2 - warn, 3 - error
    namespaceT.logLevel = 2;

    // Extend an object's properties from one (or more) additional
    // objects.

    var enumBug = !{toString: true}.propertyIsEnumerable('toString');
    var internalNames = ['toString', 'toLocaleString', 'valueOf',
                         'constructor', 'isPrototypeOf'];
    function extendObject(dest, args) {
        var i, j;
        var source;
        var prop;

        if (dest === undefined) {
            dest = {};
        }
        for (i = 1; i < arguments.length; i++) {
            source = arguments[i];
            for (prop in source) {
                if (source.hasOwnProperty(prop)) {
                    dest[prop] = source[prop];
                }
            }
            if (!enumBug) {
                continue;
            }
            for (j = 0; j < internalNames.length; j++) {
                prop = internalNames[j];
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
        },

        // Closure to delegate calls to a function wrapper.
        // Calling params for wrapper are: (this, fn, arguments).
        fnWrap: function(fn) {
            var _fn = this;
            return function() {
                var self = this;
                return _fn(self, fn, arguments);
            };
        }
    });

    // Functions added to every Namespace.
    Namespace.methods({
        // Call a function with the namespace as a parameter - forming
        // a closure for the namespace definition.
        define: function(closure) {
            this._isDefined = true;
            this._closure = closure;
            if (namespaceT.logLevel <= 1) {
                console.info("Namespace '" + this._path + "' defined.");
            }
            if (closure) {
                Namespace.defining = this;
                closure(this);
                Namespace.defining = undefined;
            }
            return this;
        },

        // Same as define, but will not execute the callback more than once.
        defineOnce: function(callback) {
            // In case a namespace is multiply loaded, we ignore the
            // definition function for all but the first call.
            if (this._isDefined) {
                if (namespaceT.logLevel <= 2) {
                    console.warn("Namespace '" + this._path +
                                 "' redefinition.");
                }
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
        _isDefined: true,

        lookup: function(path) {
            var fCreated = false;
            path = path.replace(/-/g, '_');
            var parts = path.split('.');
            var cur = namespaceT;
            for (var i = 0; i < parts.length; i++) {
                var name = parts[i];
                // Ignore empty path parts
                if (name == '') {
                    continue;
                }
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
                    if (namespaceT.logLevel <= 2) {
                        console.warn("Forward reference from " +
                                     Namespace.defining._path + " to " +
                                     path + ".");
                    }
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
        this.clear();
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
       into the new object.  Ignore undefined properties. */
    function project(obj, asProps) {
        var objT = {};
        for (var i = 0; i < asProps.length; i++) {
            var name = asProps[i];
            if (obj && obj.hasOwnProperty(name)) {
                objT[name] = obj[name];
            }
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

    function isArguments(a) {
        return typeof a == 'object' &&
            a.length != undefined &&
            a.callee != undefined;
    }

    /* Sort elements and remove duplicates from array (modified in place) */
    function uniqueArray(a) {
        if (!(a instanceof Array)) {
            return;
        }
        a.sort();
        for (var i = 1; i < a.length; i++) {
            if (a[i - 1] == a[i]) {
                a.splice(i, 1);
            }
        }
    }

    function generalType(o) {
        var t = typeof(o);
        if (t != 'object') {
            return t;
        }
        if (o instanceof String) {
            return 'string';
        }
        if (o instanceof Number) {
            return 'number';
        }
        return t;
    }

    // Perform a deep comparison to check if two objects are equal.
    // Inspired by Underscore.js 1.1.0 - some semantics modifed.
    // Undefined properties are treated the same as un-set properties
    // in both Arrays and Objects.
    // Note that two objects with the same OWN properties can be equal
    // if they have different prototype chains (and inherited values).
    function isEqual(a, b) {
        if (a === b) {
            return true;
        }

        if (generalType(a) != generalType(b)) {
            return false;
        }

        if (a == b) {
            return true;
        }

        if (typeof a != 'object') {
            return false;
        }

        // null != {}
        if (a instanceof Object != b instanceof Object) {
            return false;
        }

        if (a instanceof Date || b instanceof Date) {
            if (a instanceof Date != b instanceof Date ||
                a.getTime() != b.getTime()) {
                return false;
            }
        }

        var allKeys = [].concat(keys(a), keys(b));
        uniqueArray(allKeys);

        for (var i = 0; i < allKeys.length; i++) {
            var prop = allKeys[i];
            if (!isEqual(a[prop], b[prop])) {
                return false;
            }
        }
        return true;
    }

    // Copy any values that have changed from latest to last,
    // into dest (and update last as well).  This function will
    // never set a value in dest to 'undefined'.
    // Returns true iff dest was modified.
    function extendIfChanged(dest, last, latest) {
        var f = false;
        for (var prop in latest) {
            if (latest.hasOwnProperty(prop)) {
                var value = latest[prop];
                if (value == undefined) {
                    continue;
                }
                if (!isEqual(last[prop], value)) {
                    last[prop] = value;
                    dest[prop] = value;
                    f = true;
                }
            }
        }
        return f;
    }

    function ensureArray(a) {
        if (a == undefined) {
            a = [];
        } else if (isArguments(a)) {
            a = util.copyArray(a);
        } else if (!(a instanceof Array)) {
            a = [a];
        }

        return a;
    }

    function indexOf(value, a) {
        a = ensureArray(a);
        for (var i = 0; i < a.length; i++) {
            if (value == a[i]) {
                return i;
            }
        }
        return -1;
    }

    function map(a, fn) {
        a = ensureArray(a);
        var aRes = [];
        for (var i = 0; i < a.length; i++) {
            aRes.push(fn(a[i]));
        }
        return aRes;
    }

    function filter(a, fn) {
        a = ensureArray(a);
        var aRes = [];
        for (var i = 0; i < a.length; i++) {
            if (fn(a[i])) {
                aRes.push(a[i]);
            }
        }
        return aRes;
    }

    function reduce(a, fn) {
        a = ensureArray(a);
        if (a.length < 2) {
            return a[0];
        }
        var res = a[0];
        for (var i = 1; i < a.length; i++) {
            res = fn(res, a[i]);
        }
        return res;
    }

    // Calls fn(element, index) for each (defined) element.
    // Works for Arrays and Objects
    // Force an early exit from the loop by returning false;
    function forEach(a, fn) {
        var ret;

        if (a instanceof Array || a.length != undefined) {
            for (var i = 0; i < a.length; i++) {
                if (a[i] != undefined) {
                    ret = fn(a[i], i);
                    if (ret === false) {
                        return;
                    }
                }
            }
            return;
        }

        for (var prop in a) {
            if (a.hasOwnProperty(prop)) {
                ret = fn(a[prop], prop);
                if (ret === false) {
                    return;
                }
            }
        }
    }

    function dictFromArray(a, keyName) {
        var d = {};
        for (var i = 0; i < a.length; i++) {
            if (a[i] === undefined || !(keyName in a[i])) {
                continue;
            }
            d[a[i][keyName]] = a[i];
        }
        return d;
    }

    // TODO: Use native implementations where available
    // in Array.prototype: map, reduce, filter, every, some,
    // indexOf, lastIndexOf.
    // and in Object.prototype: keys
    // see ECMA5 spec.
    ns.extend({
        'extendObject': util.extendObject,
        'Enum': Enum,
        'StBuf': StBuf,

        'extendIfMissing': extendIfMissing,
        'extendIfChanged': extendIfChanged,
        'extendDeep': extendDeep,
        'randomInt': randomInt,
        'strip': strip,
        'project': project,
        'uniqueArray': uniqueArray,
        'indexOf': indexOf,
        'map': map,
        'filter': filter,
        'reduce': reduce,
        'keys': keys,
        'forEach': forEach,
        'ensureArray': ensureArray,
        'isEqual': isEqual,
        'dictFromArray': dictFromArray
    });

}); // startpad.base
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
/* Begin file: random.js */
namespace.lookup("org.startpad.random").defineOnce(function(ns) {

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

});
/* Begin file: crypto.js */
/*
 * Crypto-JS trunk (r291)
 * http://code.google.com/p/crypto-js/
 * Copyright (c) 2009, Jeff Mott. All rights reserved.
 * http://code.google.com/p/crypto-js/wiki/License
 */

//////////////////////////////// Crypto.js ////////////////////////////////

(function () {

/* Global crypto object
 ---------------------------------------------------------------------------- */
var C = namespace.lookup('com.googlecode.crypto-js');

/* Types
 ---------------------------------------------------------------------------- */
var types = C.types = {};

/* Word arrays
 ------------------------------------------------------------- */
var WordArray = types.WordArray = {

    // Get significant bytes
    getSigBytes: function (words) {
        if (words["_Crypto"] && words["_Crypto"].sigBytes != undefined) {
            return words["_Crypto"].sigBytes;
        } else {
            return words.length * 4;
        }
    },

    // Set significant bytes
    setSigBytes: function (words, n) {
        words["_Crypto"] = { sigBytes: n };
    },

    // Concatenate word arrays
    cat: function (w1, w2) {
        return ByteStr.decode(ByteStr.encode(w1) + ByteStr.encode(w2));
    }

};

/* Encodings
 ---------------------------------------------------------------------------- */
var enc = C.enc = {};

/* Byte strings
 ------------------------------------------------------------- */
var ByteStr = enc.ByteStr = {

    encode: function (words) {

        var sigBytes = WordArray.getSigBytes(words);
        var str = [];

        for (var i = 0; i < sigBytes; i++) {
            str.push(String.fromCharCode((words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xFF));
        }

        return str.join("");

    },

    decode: function (str) {

        var words = [];

        for (var i = 0; i < str.length; i++) {
            words[i >>> 2] |= str.charCodeAt(i) << (24 - (i % 4) * 8);
        }
        WordArray.setSigBytes(words, str.length);

        return words;

    }

};

/* UTF8 strings
 ------------------------------------------------------------- */
enc.UTF8 = {

    encode: function (words) {
        return decodeURIComponent(escape(ByteStr.encode(words)));
    },

    decode: function (str) {
        return ByteStr.decode(unescape(encodeURIComponent(str)));
    }

};

/* Word arrays
 ------------------------------------------------------------- */
enc.Words = {
    encode: function (words) { return words; },
    decode: function (words) { return words; }
};

})();

//////////////////////////////// Hex.js ////////////////////////////////

(function () {

// Shortcuts
var C = namespace.lookup('com.googlecode.crypto-js');
var WordArray = C.types.WordArray;

C.enc.Hex = {

    encode: function (words) {

        var sigBytes = WordArray.getSigBytes(words);
        var hex = [];

        for (var i = 0; i < sigBytes; i++) {
            var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xFF;
            hex.push((bite >>> 4).toString(16));
            hex.push((bite & 0xF).toString(16));
        }

        return hex.join("");

    },

    decode: function (hex) {

        var words = [];

        for (var i = 0; i < hex.length; i += 2) {
            words[i >>> 3] |= parseInt(hex.substr(i, 2), 16) << (24 - (i % 8) * 4);
        }
        WordArray.setSigBytes(words, hex.length / 2);

        return words;

    }

};

})();

//////////////////////////////// Base64.js ////////////////////////////////

(function () {

// Shortcuts
var C = namespace.lookup('com.googlecode.crypto-js');
var WordArray = C.types.WordArray;

// Base-64 encoding map
var b64map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

C.enc.Base64 = {

    encode: function (words) {

        var sigBytes = WordArray.getSigBytes(words);
        var b64str = [];

        for(var i = 0; i < sigBytes; i += 3) {

            var triplet = (((words[(i    ) >>> 2] >>> (24 - ((i    ) % 4) * 8)) & 0xFF) << 16) |
                          (((words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xFF) <<  8) |
                          ( (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xFF);

            for (var j = 0; j < 4; j++) {
                if (i + j * 0.75 <= sigBytes) {
                    b64str.push(b64map.charAt((triplet >>> (6 * (3 - j))) & 0x3F));
                } else {
                    b64str.push("=");
                }
            }

        }

        return b64str.join("");

    },

    decode: function (b64str) {

        // Remove padding
        b64str = b64str.replace(/=+$/, "");

        var words = [];
        for (var i = 0, bites = 0; i < b64str.length; i++) {
            if (i % 4) {
                words[bites >>> 2] |= (((b64map.indexOf(b64str.charAt(i - 1)) << ((i % 4) * 2)) |
                                        (b64map.indexOf(b64str.charAt(i)) >>> (6 - (i % 4) * 2))) & 0xFF) << (24 - (bites % 4) * 8);
                bites++;
            }
        }
        WordArray.setSigBytes(words, bites);

        return words;

    }

};

})();

//////////////////////////////// SHA1.js ////////////////////////////////

(function () {

// Shortcuts
var C = namespace.lookup('com.googlecode.crypto-js');
var UTF8 = C.enc.UTF8;
var WordArray = C.types.WordArray;

// Public API
var SHA1 = C.SHA1 = function (message, options) {

    // Digest
    var digestWords = SHA1.digest(message);

    // Set default output
    var output = options && options.output || C.enc.Hex;

    // Return encoded output
    return output.encode(digestWords);

};

// The core
SHA1.digest = function (message) {

    // Convert to words, else assume words already
    var m = message.constructor == String ? UTF8.decode(message) : message;

    // Add padding
    var l = WordArray.getSigBytes(m) * 8;
    m[l >>> 5] |= 0x80 << (24 - l % 32);
    m[(((l + 64) >>> 9) << 4) + 15] = l;

    // Initial values
    var w  = [];
    var H0 = 0x67452301;
    var H1 = 0xEFCDAB89;
    var H2 = 0x98BADCFE;
    var H3 = 0x10325476;
    var H4 = 0xC3D2E1F0;

    for (var i = 0; i < m.length; i += 16) {

        var a = H0;
        var b = H1;
        var c = H2;
        var d = H3;
        var e = H4;

        for (var j = 0; j < 80; j++) {

            if (j < 16) w[j] = m[i + j];
            else {
                var n = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
                w[j] = (n << 1) | (n >>> 31);
            }

            var t = ((H0 << 5) | (H0 >>> 27)) + H4 + (w[j] >>> 0) + (
                     j < 20 ? ((H1 & H2) | (~H1 & H3))            + 0x5A827999 :
                     j < 40 ?  (H1 ^ H2 ^ H3)                     + 0x6ED9EBA1 :
                     j < 60 ? ((H1 & H2) | (H1 & H3) | (H2 & H3)) - 0x70E44324 :
                               (H1 ^ H2 ^ H3)                     - 0x359D3E2A);

            H4 = H3;
            H3 = H2;
            H2 = (H1 << 30) | (H1 >>> 2);
            H1 = H0;
            H0 = t;

        }

        H0 += a;
        H1 += b;
        H2 += c;
        H3 += d;
        H4 += e;

    }

    return [H0, H1, H2, H3, H4];

};

// Block size
SHA1.blockSize = 16;

})();

//////////////////////////////// HMAC.js ////////////////////////////////

(function () {

// Shortcuts
var C = namespace.lookup('com.googlecode.crypto-js');
var UTF8 = C.enc.UTF8;
var Words = C.enc.Words;
var WordArray = C.types.WordArray;

C.HMAC = function (hasher, message, key, options) {

    // Convert to words, else assume words already
    var m = message.constructor == String ? UTF8.decode(message) : message;
    var k = key.constructor == String ? UTF8.decode(key) : key;

    // Allow arbitrary length keys
    if (k.length > hasher.blockSize) {
        k = hasher(k, { output: Words });
    }

    // XOR keys with pad constants
    var oKey = k.slice(0);
    var iKey = k.slice(0);
    for (var i = 0; i < hasher.blockSize; i++) {
        oKey[i] ^= 0x5C5C5C5C;
        iKey[i] ^= 0x36363636;
    }

    // Hash
    var hmacWords = hasher(WordArray.cat(oKey, hasher(WordArray.cat(iKey, m), { output: Words })), { output: Words });

    // Set default output
    var output = options && options.output || C.enc.Hex;

    // Return encoded output
    return output.encode(hmacWords);

};

})();
/* Begin file: forms.js */
namespace.lookup('com.pageforest.forms').define(function(ns) {

    function showValidatorResults(fields, errors, options) {
        var ignoreEmpty = options && options.ignoreEmpty;
        for (var index = 0; index < fields.length; index++) {
            var name = fields[index];
            var html = errors[name];
            if (ignoreEmpty && $("#id_" + name).val() === '') {
                html = '';
            } else if (html) {
                html = '<span class="error">' + html + '</span>';
            } else {
                html = '<span class="success">OK</span>';
            }
            $("#validate_" + name).html(html);
        }
    }

    function postFormData(url, data, onSuccess, onValidate, onError) {
        $.ajax({
            type: "POST",
            url: url,
            data: data,
            dataType: "json",
            success: function(message, status, xhr) {
                if (message.status == 200) {
                    if (onSuccess) {
                        onSuccess(message, status, xhr);
                    }
                } else {
                    if (onValidate) {
                        onValidate(message, status, xhr);
                    }
                }
            },
            error: onError
        });
    }

    ns.extend({
        showValidatorResults: showValidatorResults,
        postFormData: postFormData
    });

}); // com.pageforest.forms
/* Begin file: sign-up.js */
namespace.lookup('com.pageforest.auth.sign-up').define(function(ns) {

    var cookies = namespace.lookup('org.startpad.cookies');
    var crypto = namespace.lookup('com.googlecode.crypto-js');
    var forms = namespace.lookup('com.pageforest.forms');

    function validatePassword() {
        var password = $("#id_password").val();
        var repeat = $("#id_repeat").val();
        if (!password.length) {
            return {password: "This field is required."};
        }
        if (password.length < 6) {
            return {password:
                    "Ensure this value has at least 6 characters (it has " +
                    password.length + ")."};
        }
        if (password != repeat) {
            return {repeat: "Password and repeat are not the same."};
        }
        return false;
    }

    function onValidate(message, status, xhr, options) {
        // Validate password fields on the client side.
        var passwordErrors = validatePassword();
        for (var error in passwordErrors) {
            if (passwordErrors.hasOwnProperty(error)) {
                message[error] = passwordErrors[error];
            }
        }
        var fields = ['username', 'password', 'repeat', 'email'];
        if (!options || !options.ignoreEmpty) {
            fields.push('tos');
        }
        forms.showValidatorResults(fields, message, options);
    }

    function onValidateIgnoreEmpty(message, status, xhr) {
        onValidate(message, status, xhr, {ignoreEmpty: true});
    }

    function onSuccess(message, status, xhr) {
        window.location = '/sign-in/';
    }

    function onError(xhr, status, message) {
        console.error(xhr);
    }

    function getFormData() {
        var username = $("#id_username").val();
        var lower = username.toLowerCase();
        var password = $("#id_password").val();
        return {
            username: username,
            password: crypto.HMAC(crypto.SHA1, lower, password),
            email: $("#id_email").val(),
            tos: $("#id_tos").attr('checked') ? 'checked' : ''
        };
    }

    function isChanged() {
        var username = $("#id_username").val();
        var password = $("#id_password").val();
        var repeat = $("#id_repeat").val();
        var email = $("#id_email").val();
        var oneline = [username, password, repeat, email].join('|');
        if (oneline == ns.previous) {
            return false;
        }
        ns.previous = oneline;
        return true;
    }

    function validateIfChanged() {
        if (!isChanged()) {
            return;
        }
        var data = getFormData();
        data.validate = true;
        forms.postFormData('/sign-up/', data,
                           null, onValidateIgnoreEmpty, onError);
    }

    function onSubmit() {
        var errors = validatePassword();
        if (errors) {
            forms.showValidatorResults(['password', 'repeat'], errors);
        } else {
            forms.postFormData('/sign-up/', getFormData(),
                               onSuccess, onValidate, onError);
        }
        return false;
    }

    // Request a new email verification for the signed in user.
    function resend() {
        console.log("resend");
        $.ajax({
            type: "POST",
            url: "/email-verify/",
            data: {resend: true},
            dataType: "json",
            success: function() {
                $('span#result').css('color', '#0A0')
                    .html("A new verification email was sent.");
            },
            error: function() {
                $('span#result').css('color', '#F00')
                    .html("Sorry, please try again later.");
            }
        });
        return false;
    }

    function onReady() {
        // Hide message about missing JavaScript.
        $('#enablejs').hide();
        $('input').removeAttr('disabled');
        // Show message about missing HttpOnly support.
        if (cookies.getCookie('httponly')) {
            $('#httponly').show();
        }

        // Initialize ns.previous to track input changes.
        isChanged();
        // Validate in the background
        setInterval(validateIfChanged, 1000);
        $('#id_tos').click(function() {
            $('#validate_tos').html('');
        });
    }

    ns.extend({
        onReady: onReady,
        onSubmit: onSubmit,
        resend: resend
    });

}); // com.pageforest.auth.sign-up
/* Begin file: sign-in.js */
/*
  Handle logging a user into Pageforest and optionally also log them
  in to a Pageforest application.

  A logged in use will get a session key on www.pageforest.com. This
  script makes requests to appid.pageforest.com in order to get a
  cookie set on the application domain when the user wants to allow
  the application access to his store.
*/

namespace.lookup('com.pageforest.auth.sign-in').define(function(ns) {

    var cookies = namespace.lookup('org.startpad.cookies');
    var crypto = namespace.lookup('com.googlecode.crypto-js');
    var forms = namespace.lookup('com.pageforest.forms');

    // www.pageforest.com -> app.pageforest.com
    // pageforest.com -> app.pageforest.com
    function getAppDomain(appId) {
        var parts = window.location.host.split('.');
        if (parts[0] == 'www') {
            parts[0] = appId;
        } else {
            parts.splice(0, 0, appId);
        }
        return parts.join('.');
    }

    // Use JSONP to read the username from the cross-site application.
    function getJSONP(url, fn) {
        $.ajax({
            type: "GET",
            url: url,
            dataType: "jsonp",
            success: fn,
            // We return a 404 for the jsonP - when can trigger this error
            // Review: would be better to tunnel all results at 200 with
            // embedded error status.
            error: function() {
                fn({status: 500});
            }
        });
    }

    // Display success, and close window in 2 seconds.
    function closeForm() {
        if (ns.appId) {
            $(".have_app").show();
        }
        $(".want_app").hide();
        setTimeout(window.close, 2000);
    }

    // Send a valid appId sessionKey to the app domain
    // to get it installed on a cookie.
    function transferSession(sessionKey, fn) {
        var url = ns.appAuthURL + "set-session/" + sessionKey;
        getJSONP(url, function(message) {
            if (typeof(message) != 'string') {
                return;
            }
            if (fn) {
                fn();
            }

            // Close the window if this was used to
            // sign in to the app.
            if (sessionKey) {
                closeForm();
            }
        });
        return false;
    }

    function onSuccess(message, status, xhr) {
        if (message.sessionKey) {
            transferSession(message.sessionKey, function() {
                window.location.reload();
            });
            return;
        }
        window.location.reload();
    }

    function onError(xhr, status, message) {
        var text = xhr.responseText;
        if (text.substr(0, 19) == 'Invalid signature: ') {
            text = text.substr(19);
        }
        if (/(user|account)/i.test(text)) {
            forms.showValidatorResults(
                ['username', 'password'], {username: text, password: ' '});
        } else {
            forms.showValidatorResults(
                ['username', 'password'], {password: text});
        }
    }

    function onChallenge(challenge, status, xhr) {
        var username = $('#id_username').val();
        var lower = username.toLowerCase();
        var password = $('#id_password').val();
        var userpass = crypto.HMAC(crypto.SHA1, lower, password);
        var signature = crypto.HMAC(crypto.SHA1, challenge, userpass);
        var reply = lower + '|' + challenge + '|' + signature;
        $.ajax({
            url: '/auth/verify/' + reply,
            success: onSuccess,
            error: onError
        });
    }

    function onSubmit() {
        $.ajax({
            url: '/auth/challenge',
            success: onChallenge,
            error: onError
        });
        return false;
    }

    // Check if user is already logged in.
    function onReady(username, appId) {
        // Hide message about missing JavaScript.
        $('#enablejs').hide();
        $('input').removeAttr('disabled');
        // Show message about missing HttpOnly support.
        if (cookies.getCookie('httponly')) {
            $('#httponly').show();
        }

        ns.appId = appId;
        ns.appAuthURL = 'http://' + getAppDomain(appId) + '/auth/';

        // Nothing to do until the user signs in - page will reload
        // on form post.
        if (!username) {
            return;
        }

        // Check (once) if we're also currently logged in @ appId
        // without having to sign-in again.
        // REVIEW: Isn't this insecure?
        var url = ns.appAuthURL + "username/";
        getJSONP(url, function(username) {
            // We're already logged in!
            if (typeof(username) == 'string') {
                closeForm();
                return;
            }
        });
    }

    function signOut() {
        if (ns.appId) {
            transferSession('expired', function() {
                window.location = '/sign-out/' + ns.appId;
            });
            return;
        }
        window.location = '/sign-out/';
    }

    ns.extend({
        'onReady': onReady,
        'onSubmit': onSubmit,
        'transferSession': transferSession,
        'signOut': signOut
    });

}); // com.pageforest.auth.sign-in
/* Begin file: profile.js */
namespace.lookup('com.pageforest.auth.profile').define(function(ns) {

    var cookies = namespace.lookup('org.startpad.cookies');
    var crypto = namespace.lookup('com.googlecode.crypto-js');
    var forms = namespace.lookup('com.pageforest.forms');

    function validatePassword() {
        var password = $("#id_password").val();
        var repeat = $("#id_repeat").val();
        if (!password.length) {
            return {password: "This field is required."};
        }
        if (password.length < 6) {
            return {password:
                    "Ensure this value has at least 6 characters (it has " +
                    password.length + ")."};
        }
        if (password != repeat) {
            return {repeat: "Password and repeat are not the same."};
        }
        return false;
    }

    function onValidate(message, status, xhr, options) {
        // Validate password fields on the client side.
        var passwordErrors = validatePassword();
        for (var error in passwordErrors) {
            if (passwordErrors.hasOwnProperty(error)) {
                message[error] = passwordErrors[error];
            }
        }
        var fields = ['username', 'password', 'repeat', 'email'];
        if (!options || !options.ignoreEmpty) {
            fields.push('tos');
        }
        forms.showValidatorResults(fields, message, options);
    }

    function onValidateIgnoreEmpty(message, status, xhr) {
        onValidate(message, status, xhr, {ignoreEmpty: true});
    }

    function onSuccess(message, status, xhr) {
        window.location = '/sign-in/';
    }

    function onError(xhr, status, message) {
        console.error(xhr);
    }

    function getFormData() {
        var username = $("#id_username").val();
        var lower = username.toLowerCase();
        var password = $("#id_password").val();
        return {
            username: username,
            password: crypto.HMAC(crypto.SHA1, lower, password),
            email: $("#id_email").val(),
            tos: $("#id_tos").attr('checked') ? 'checked' : ''
        };
    }

    function isChanged() {
        var username = $("#id_username").val();
        var password = $("#id_password").val();
        var repeat = $("#id_repeat").val();
        var email = $("#id_email").val();
        var oneline = [username, password, repeat, email].join('|');
        if (oneline == ns.previous) {
            return false;
        }
        ns.previous = oneline;
        return true;
    }

    function validateIfChanged() {
        if (!isChanged()) {
            return;
        }
        var data = getFormData();
        data.validate = true;
        forms.postFormData('/sign-up/', data,
                           null, onValidateIgnoreEmpty, onError);
    }

    function onSubmit() {
        var errors = validatePassword();
        if (errors) {
            forms.showValidatorResults(['password', 'repeat'], errors);
        } else {
            forms.postFormData('/sign-up/', getFormData(),
                               onSuccess, onValidate, onError);
        }
        return false;
    }

    // Request a new email verification for the signed in user.
    function resend() {
        console.log("resend");
        $.ajax({
            type: "POST",
            url: "/email-verify/",
            data: {resend: true},
            dataType: "json",
            success: function() {
                $('span#result').css('color', '#0A0')
                    .html("A new verification email was sent.");
            },
            error: function() {
                $('span#result').css('color', '#F00')
                    .html("Sorry, please try again later.");
            }
        });
        return false;
    }

    function onReady() {
        // Hide message about missing JavaScript.
        $('#enablejs').hide();
        $('input').removeAttr('disabled');
        // Show message about missing HttpOnly support.
        if (cookies.getCookie('httponly')) {
            $('#httponly').show();
        }

        // Initialize ns.previous to track input changes.
        isChanged();
        // Validate in the background
        setInterval(validateIfChanged, 1000);
        $('#id_tos').click(function() {
            $('#validate_tos').html('');
        });
    }

    ns.extend({
        onReady: onReady,
        onSubmit: onSubmit,
        resend: resend
    });

}); // com.pageforest.auth.sign-up
