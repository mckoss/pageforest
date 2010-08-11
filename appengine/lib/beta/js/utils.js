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

    // Calls fn(element, index) for each (defined) element.
    // Works for Arrays and Objects
    // Force an early exit from the loop by returning false;
    function forEach(a, fn) {
        var ret;

        if (a instanceof Array) {
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
        'keys': keys,
        'forEach': forEach
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
/* Begin file: format.js */
/*globals atob */

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
        var s = integerPart.toString();
        var sLast = "";
        while (s != sLast) {
            sLast = s;
            s = s.replace(/(\d+)(\d{3})/, "$1" + comma + "$2");
        }

        var fractionString = "";
        if (digits && digits >= 1) {
            digits = Math.floor(digits);
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

    var base64map =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    // Convert a base-64 string to a binary-encoded string
    function base64ToString(base64) {
        var b;

        // Use browser-native function if it exists
        if (typeof atob == "function") {
            return atob(base64);
        }

        // Remove non-base-64 characters
        base64 = base64.replace(/[^A-Z0-9+\/]/ig, "");

        for (var chars = [], i = 0, imod4 = 0;
             i < base64.length;
             imod4 = ++i % 4) {
            if (imod4 == 0) {
                continue;
            }
            b = ((base64map.indexOf(base64.charAt(i - 1)) &
                  (Math.pow(2, -2 * imod4 + 8) - 1)) << (imod4 * 2)) |
                (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2));
            chars.push(String.fromCharCode(b));
        }

        return chars.join('');

    }

    function canvasToPNG(canvas) {
        var prefix = "data:image/png;base64,";
        var data = canvas.toDataURL('image/png');
        if (data.indexOf(prefix) != 0) {
            return undefined;
        }
        //return base64ToString(data.substr(prefix.length));
        return data.substr(prefix.length);
    }

    ns.extend({
        'fixedDigits': fixedDigits,
        'thousands': thousands,
        'slugify': slugify,
        'escapeHTML': escapeHTML,
        'replaceKeys': replaceKeys,
        'replaceString': replaceString,
        'base64ToString': base64ToString,
        'canvasToPNG': canvasToPNG
    });
}); // org.startpad.format
/* Begin file: vector.js */
// --------------------------------------------------------------------------
// Vector Functions
// --------------------------------------------------------------------------
namespace.lookup('org.startpad.vector').defineOnce(function(ns) {
    var util = namespace.util;

    ns.extend({
        x: 0,
        y: 1,
        x2: 2,
        y2: 3,

        subFrom: function(v1, v2) {
            for (var i = 0; i < v1.length; i++) {
                v1[i] = v1[i] - v2[i % v2.length];
            }
            return v1;
        },

        sub: function(v1, v2) {
            var vDiff = ns.copy(v1);
            return ns.subFrom(vDiff, v2);
        },

        // In-place vector addition
        // If smaller arrays are added to larger ones, they wrap around
        // so that points can be added to rects, for example.
        addTo: function(vSum) {
            for (var iarg = 1; iarg < arguments.length; iarg++) {
                var v = arguments[iarg];
                for (var i = 0; i < vSum.length; i++) {
                    vSum[i] += v[i % v.length];
                }
            }
            return vSum;
        },

        // Add corresponding elements of all arguments
        add: function() {
            var vSum = ns.copy(arguments[0]);
            var args = util.copyArray(arguments);
            args[0] = vSum;
            return ns.addTo.apply(undefined, args);
        },

        // Return new vector with element-wise max All arguments must
        // be same dimensioned array.

        // TODO: Allow mixing scalars - share code with mult -
        // iterator/callback pattern
        max: function() {
            var vMax = ns.copy(arguments[0]);
            for (var iarg = 1; iarg < arguments.length; iarg++) {
                var v = arguments[iarg];
                for (var i = 0; i < vMax.length; i++) {
                    if (v[i] > vMax[i]) {
                        vMax[i] = v[i];
                    }
                }
            }
            return vMax;
        },

        // Multiply corresponding elements of all arguments (including scalars)
        // All vectors must be the same dimension (length).
        mult: function() {
            var vProd = 1;
            var i;
            for (var iarg = 0; iarg < arguments.length; iarg++) {
                var v = arguments[iarg];
                if (typeof v === "number") {
                    // mult(scalar, scalar)
                    if (typeof vProd === "number") {
                        vProd *= v;
                    }
                    // mult(vector, scalar)
                    else {
                        for (i = 0; i < vProd.length; i++) {
                            vProd[i] *= v;
                        }
                    }
                }
                else {
                    // mult(scalar, vector)
                    if (typeof vProd === "number") {
                        var vT = vProd;
                        vProd = ns.copy(v);
                        for (i = 0; i < vProd.length; i++) {
                            vProd[i] *= vT;
                        }
                    }
                    // mult(vector, vector)
                    else {
                        if (v.length !== vProd.length) {
                            throw new Error("Mismatched Vector Size");
                        }
                        for (i = 0; i < vProd.length; i++) {
                            vProd[i] *= v[i];
                        }
                    }
                }
            }
            return vProd;
        },

        floor: function(v) {
            var vFloor = [];
            for (var i = 0; i < v.length; i++) {
                vFloor[i] = Math.floor(v[i]);
            }
            return vFloor;
        },

        dotProduct: function() {
            var v = ns.mult.apply(undefined, arguments);
            var s = 0;
            for (var i = 0; i < v.length; i++) {
                s += v[i];
            }
            return s;
        },

        // Append all arrays into a new array (append(v) is same as copy(v)
        append: function() {
            var v1 = Array.prototype.concat.apply([], arguments);
            return v1;
        },

        // Do a (deep) comparison of two arrays. Any embeded objects
        // are assumed to also be arrays of scalars or other arrays.
        equal: function(v1, v2) {
            if (v1.length != v2.length) {
                return false;
            }
            for (var i = 0; i < v1.length; i++) {
                if (typeof v1[i] != typeof v2[i]) {
                    return false;
                }
                if (typeof v1[i] == "object") {
                    if (!ns.equal(v1[i], v2[i])) {
                        return false;
                    }
                } else {
                    if (v1[i] != v2[i]) {
                        return false;
                    }
                }
            }
            return true;
        },

        // Routines for dealing with Points [x, y] and Rects [left,
        // top, bottom, right]
        ul: function(rc) {
            return rc.slice(0, 2);
        },

        lr: function(rc) {
            return rc.slice(2, 4);
        },

        size: function(rc) {
            return ns.sub(ns.lr(rc), ns.ul(rc));
        },

        numInRange: function(num, numMin, numMax) {
            return num >= numMin && num <= numMax;
        },

        clipToRange: function(num, numMin, numMax) {
            if (num < numMin) {
                return numMin;
            }
            if (num > numMax) {
                return numMax;
            }
            return num;
        },

        ptInRect: function(pt, rc) {
            return ns.numInRange(pt[ns.x], rc[ns.x], rc[ns.x2]) &&
                ns.numInRange(pt[ns.y], rc[ns.y], rc[ns.y2]);
        },

        ptClipToRect: function(pt, rc) {
            return [ns.clipToRange(pt[ns.x], rc[ns.x], rc[ns.x2]),
                    ns.clipToRange(pt[ns.y], rc[ns.y], rc[ns.y2])];
        },

        rcClipToRect: function(rc, rcClip) {
            return ns.append(ns.ptClipToRect(ns.ul(rc), rcClip),
                             ns.ptClipToRect(ns.lr(rc), rcClip));
        },

        rcExpand: function(rc, ptSize) {
            return ns.append(ns.sub(ns.ul(rc), ptSize),
                             ns.add(ns.lr(rc), ptSize));
        },

        keepInRect: function(rcIn, rcBound) {
            // First, make sure the rectangle is not bigger than
            // either bound dimension
            var ptFixSize = ns.max([0, 0], ns.sub(ns.size(rcIn),
                                                  ns.size(rcBound)));
            rcIn[ns.x2] -= ptFixSize[ns.x];
            rcIn[ns.y2] -= ptFixSize[ns.y];
            // Now move the rectangle to be totally within the bounds
            var dx = 0;
            var dy = 0;
            dx = Math.max(0, rcBound[ns.x] - rcIn[ns.x]);
            dy = Math.max(0, rcBound[ns.y] - rcIn[ns.y]);
            if (dx == 0) {
                dx = Math.min(0, rcBound[ns.x2] - rcIn[ns.x2]);
            }
            if (dy == 0) {
                dy = Math.min(0, rcBound[ns.y2] - rcIn[ns.y2]);
            }
            ns.addTo(rcIn, [dx, dy]);
        },

        // Return pt (1-scale) * ul + scale * lr
        ptCenter: function(rc, scale) {
            if (scale === undefined) {
                scale = 0.5;
            }
            if (typeof scale === "number") {
                scale = [scale, scale];
            }
            var pt = ns.mult(scale, ns.lr(rc));
            scale = ns.sub([1, 1], scale);
            ns.addTo(pt, ns.mult(scale, ns.ul(rc)));
            return pt;
        },

        // ptRegistration - return one of 9 registration points of a rectangle
        // 0 1 2
        // 3 4 5
        // 6 7 8
        ptRegistration: function(rc, iReg) {
            var xScale = (iReg % 3) * 0.5;
            var yScale = Math.floor(iReg / 3) * 0.5;
            return ns.ptCenter(rc, [xScale, yScale]);
        },

        iRegClosest: function(pt, rc) {
            var aPoints = [];
            for (var i = 0; i < 9; i++) {
                aPoints.push(ns.ptRegistration(rc, i));
            }
            return ns.IPtClosest(pt, aPoints)[0];
        },

        // rectDeltaReg - Move or resize the rectangle based on the registration
        // point to be modified.  Center (4) moves the whole rect.
        // Others resize one or more edges of the rectangle
        rectDeltaReg: function(rc, dpt, iReg, ptSizeMin, rcBounds) {
            var rcT;
            if (iReg == 4) {
                rcT = ns.add(rc, dpt);
                if (rcBounds) {
                    ns.keepInRect(rcT, rcBounds);
                }
                return rcT;
            }
            var iX = iReg % 3;
            if (iX == 1) {
                iX = undefined;
            }
            var iY = Math.floor(iReg / 3);
            if (iY == 1) {
                iY = undefined;
            }
            function applyDelta(rc, dpt) {
                var rcDelta = [0, 0, 0, 0];
                if (iX != undefined) {
                    rcDelta[iX] = dpt[0];
                }
                if (iY != undefined) {
                    rcDelta[iY + 1] = dpt[1];
                }
                return ns.add(rc, rcDelta);
            }
            rcT = applyDelta(rc, dpt);
            // Ensure the rectangle is not less than the minimum size
            if (!ptSizeMin) {
                ptSizeMin = [0, 0];
            }
            var ptSize = ns.size(rcT);
            var ptFixSize = ns.max([0, 0], ns.sub(ptSizeMin, ptSize));
            if (iX == 0) {
                ptFixSize[0] *= -1;
            }
            if (iY == 0) {
                ptFixSize[1] *= -1;
            }
            rcT = applyDelta(rcT, ptFixSize);
            // Ensure rectangle is not outside the bounding box
            if (rcBounds) {
                ns.keepInRect(rcT, rcBounds);
            }
            return rcT;
        },

        // Find the closest point to the given point
        // (multiple) arguments can be points, or arrays of points
        // Returns [i, pt] result
        iPtClosest: function(pt) {
            var d2Min;
            var ptClosest;
            var iClosest;
            var d2;
            var iPt = 0;
            for (var iarg = 1; iarg < arguments.length; iarg++) {
                var v = arguments[iarg];
                // Looks like a single point
                if (typeof v[0] == "number") {
                    d2 = ns.Distance2(pt, v);
                    if (d2Min == undefined || d2 < d2Min) {
                        d2Min = d2;
                        ptClosest = v;
                        iClosest = iPt;
                    }
                    iPt++;
                }
                // Looks like an array of points
                else {
                    for (var i = 0; i < v.length; i++) {
                        var vT = v[i];
                        d2 = ns.Distance2(pt, vT);
                        if (d2Min == undefined || d2 < d2Min) {
                            d2Min = d2;
                            ptClosest = vT;
                            iClosest = iPt;
                        }
                        iPt++;
                    }
                }
            }
            return [iClosest, ptClosest];
        },

        // Return square of distance between to "points" (N-dimensional)
        distance2: function(v1, v2) {
            var d2 = 0;
            for (var i = 0; i < v1.length; i++) {
                d2 += Math.pow((v2[i] - v1[i]), 2);
            }
            return d2;
        },

        // Return the bounding box of the collection of pt's and rect's
        boundingBox: function() {
            var vPoints = ns.append.apply(undefined, arguments);
            if (vPoints.length % 2 !== 0) {
                throw new Error("Invalid arguments to boundingBox");
            }
            var ptMin = vPoints.slice(0, 2),
                ptMax = vPoints.slice(0, 2);
            for (var ipt = 2; ipt < vPoints.length; ipt += 2) {
                var pt = vPoints.slice(ipt, ipt + 2);
                if (pt[0] < ptMin[0]) {
                    ptMin[0] = pt[0];
                }
                if (pt[1] < ptMin[1]) {
                    ptMin[1] = pt[1];
                }
                if (pt[0] > ptMax[0]) {
                    ptMax[0] = pt[0];
                }
                if (pt[1] > ptMax[1]) {
                    ptMax[1] = pt[1];
                }
            }
            return [ptMin[0], ptMin[1], ptMax[0], ptMax[1]];
        },

        // Return json string for numeric array
        json: function(v) {
            var sRect = "[";
            var chSep = "";
            for (var i = 0; i < v.length; i++) {
                sRect += chSep + v[i];
                chSep = ",";
            }
            sRect += "]";
            return sRect;
        }
    });

    // Synonym - copy(v) is same as append(v)
    ns.copy = ns.append;
}); // startpad.vector
/* Begin file: dom.js */
//--------------------------------------------------------------------------
// DOM Functions
// Points (pt) are [x,y]
// Rectangles (rc) are [xTop, yLeft, xRight, yBottom]
//--------------------------------------------------------------------------
namespace.lookup('org.startpad.dom').define(function(ns) {
    var vector = namespace.lookup('org.startpad.vector');
    var ix = 0;
    var iy = 1;
    var ix2 = 2;
    var iy2 = 3;

    // Get absolute position on the page for the upper left of the element.
    function ptClient(elt) {
        var pt = [0, 0];

        while (elt.offsetParent !== null) {
            pt[ix] += elt.offsetLeft;
            pt[iy] += elt.offsetTop;
            elt = elt.offsetParent;
        }
        return pt;
    }

    // Return size of a DOM element in a Point - includes borders, and
    // padding, but not margins.
    function ptSize(elt) {
        return [elt.offsetWidth, elt.offsetHeight];
    }

    // Return absolute bounding rectangle for a DOM element:
    // [x, y, x + dx, y + dy]
    function rcClient(elt) {
        // TODO: Should I use getClientRects or getBoundingClientRect?
        var rc = ptClient(elt);
        var ptSize = ptSize(elt);
        rc.push(rc[ix] + ptSize[ix], rc[iy] + ptSize[iy]);
        return rc;
    }

    // Relative rectangle within containing element
    function rcOffset(elt) {
        var rc = [elt.offsetLeft, elt.offsetTop];
        var ptSize = ptSize(elt);
        rc.push(rc[ix] + ptSize[ix], rc[iy] + ptSize[iy]);
        return rc;
    }

    function ptMouse(evt) {
        var x = document.documentElement.scrollLeft || document.body.scrollLeft;
        var y = document.documentElement.scrollTop || document.body.scrollTop;
        return [x + evt.clientX, y + evt.clientY];
    }

    function rcWindow() {
        var x = document.documentElement.scrollLeft || document.body.scrollLeft;
        var y = document.documentElement.scrollTop || document.body.scrollTop;
        var dx = window.innerWidth ||
            document.documentElement.clientWidth ||
            document.body.clientWidth;
        var dy = window.innerHeight ||
            document.documentElement.clientHeight ||
            document.body.clientHeight;
        return [x, y, x + dx, y + dy];
    }

    function setAbsPosition(elt, pt) {
        elt.style.top = pt[1] + 'px';
        elt.style.left = pt[0] + 'px';
    }

    function setSize(elt, pt) {
        // Setting the width of an element INSIDE the padding
        elt.style.width = pt[0] + 'px';
        elt.style.height = pt[1] + 'px';
    }

    function setRc(elt, rc) {
        setAbsPosition(elt, vector.ul(rc));
        setSize(elt, vector.size(rc));
    }

    function removeChildren(node) {
        var child;
        for (child = node.firstChild; child; child = node.firstChild) {
            node.removeChild(child);
        }
    }

    function ancestors(elem) {
        var aAncestors = [];

        while (elem != document) {
            aAncestors.push(elem);
            elem = elem.parentNode;
        }
        return aAncestors;
    }

    // Find the height of the nearest common ancestor of elemChild and elemUncle
    function commonAncestorHeight(elemChild, elemUncle) {
        var aChild = ancestors(elemChild);
        var aUncle = ancestors(elemUncle);

        var iChild = aChild.length - 1;
        var iUncle = aUncle.length - 1;

        while (aChild[iChild] == aUncle[iUncle] && iChild >= 0) {
            iChild--;
            iUncle--;
        }

        return iChild + 1;
    }

    // Set focus() on element, but NOT at the expense of scrolling the
    // window position
    function setFocusIfVisible(elt) {
        if (!elt) {
            return;
        }

        var rcElt = rcClient(elt);
        var rcWin = rcWindow();

        if (Vector.PtInRect(Vector.UL(rcElt), rcWin) ||
            Vector.PtInRect(Vector.LR(rcElt), rcWin)) {
            elt.focus();
        }
    }

    function scrollToBottom(elt) {
        elt.scrollTop = elt.scrollHeight;
    }

    function bindIDs(aIDs) {
        var mParts = {};
        var i;

        // If no array of id's is given, return all ids defined in the document
        if (aIDs === undefined) {
            var aAll = document.getElementsByTagName("*");
            for (i = 0; i < aAll.length; i++) {
                var elt = aAll[i];
                if (elt.id && elt.id[0] != '_') {
                    mParts[elt.id] = elt;
                }
            }
            return mParts;
        }

        for (i = 0; i < aIDs.length; i++) {
            var sID = aIDs[i];
            mParts[sID] = document.getElementById(sID);
        }
        return mParts;
    }

    function initValues(aNames, mpFields, mpValues) {
        for (var i = 0; i < aNames.length; i++) {
            if (mpValues[aNames[i]] != undefined)
                mpFields[aNames[i]].value = mpValues[aNames[i]];
        }
    }

    function readValues(aNames, mpFields, mpValues) {
        for (var i = 0; i < aNames.length; i++) {
            var field = mpFields[aNames[i]];
            var value;

            if (field.type == 'checkbox') {
                value = field.checked;
            } else {
                value = field.value;
            }
            mpValues[aNames[i]] = value;
        }
    }

    /* Poor-man's JQuery compatible selector.

       Excepts simple (single) selectors in one of three formats:

       #id
       .class
       tag
    */
    function $(sSelector) {
        var ch = sSelector.substr(0,1);
        if (ch == '.' || ch == '#')
            sSelector = sSelector.substr(1);

        if (ch == '#') {
            return document.getElementById(sSelector);
        }
        if (ch == '.') {
            return ns.getElementsByClassName(sSelector);
        }
        return document.getElementsByTagName(sSelector);
    }

    function getElementsByClassName(sClassName) {
        if (document.getElementsByClassName) {
            return document.getElementsByClassName(sClassName);
        }

        return NS.GetElementsByTagClassName(document, "*", sClassName);
    }

    /*
      GetElementsByTagClassName

      Written by Jonathan Snook, http://www.snook.ca/jonathan
      Add-ons by Robert Nyman, http://www.robertnyman.com
    */

    function getElementsByTagClassName(oElm, strTagName, strClassName) {
        var arrElements = (strTagName == "*" && oElm.all)? oElm.all : oElm.getElementsByTagName(strTagName);
        var arrReturnElements = new Array();
        strClassName = strClassName.replace(/\-/g, "\\-");
        var oRegExp = new RegExp("(^|\\s)" + strClassName + "(\\s|$)");
        var oElement;
        for(var i = 0; i < arrElements.length; i++) {
            oElement = arrElements[i];
            if(oRegExp.test(oElement.className)) {
                arrReturnElements.push(oElement);
            }
        }
        return (arrReturnElements);
    }

    function getText(elt) {
        // Try FF then IE standard way of getting element text
        var sText = elt.textContent || elt.innerText || "";
        return sText.Trim();
    }

    function setText(elt, st) {
        if (elt.textContent != undefined) {
            elt.textContent = st;
        } else {
            elt.innerText = st;
        }
    }

    function insertStyle(url) {
        var head = document.getElementsByTagName('head')[0];
        var link = document.createElement('link');
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = url;
        head.appendChild(link);
    }

    ns.extend({
        'ptClient': ptClient,
        'insertStyle': insertStyle
    });

}); // startpad.dom
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
    var dom = namespace.lookup('org.startpad.dom');

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
    var docUnsavedMessage = "Document must be saved before " +
        "children can be saved.";
    var docidMessage = "Document name is missing.";

    // The application calls Client, and implements the following methods:
    // app.setDoc(jsonDocument) - Called when a new document is loaded.
    // app.getDoc() - Called to get the json data to be saved.
    // app.onSaveSuccess() - successfully saved.
    // app.onError(errorMessage) - Called when we get an error reading or
    //     writing a document (optional).
    // app.onUserChange(username) - Called when the user signs in or signs out
    // app.onStateChange(new, old) - Notify app about current state changes.
    function Client(app) {
        this.app = app;

        if (typeof $ != 'function' || $ != jQuery) {
            this.errorReport('jQuery_required', jQueryMessage);
            return;
        }

        this.appHost = window.location.host;
        var dot = this.appHost.indexOf('.');
        this.appid = this.appHost.substr(0, dot);
        this.wwwHost = 'www' + this.appHost.substr(dot);

        this.state = 'init';
        this.username = undefined;
        this.fLogging = true;
        this.fFirstPoll = true;

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
        /* These methods are related to document state management. The
           application has a "current document" state (clean, dirty,
           loading, or saving).

           load - load a document as the current document.
           save - save the current document.
           detach - disassociate the current document from a saved docid.
           setCleanDoc - mark the document as 'clean' and update the
               browser address.
           checkDoc - polls to see if a document has changed.
           */

        // Load a document as the default document for this running application.
        load: function (docid) {
            if (this.app.setDoc == undefined) {
                return;
            }

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
            if (this.isSaved()) {
                return;
            }

            // TODO: Call this.putDoc - and then handle the document
            // state in the callback function.
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

            docid = docid || this.docid;

            // First save?  Assign docid like username-slug
            // FIXME: We could over-write a previously existing document
            // with the same name.  We should do one of:
            // - Check for existence first
            // - Ask the server for a unique docid
            // - Add some randomness to the docid
            // - Use PUT if_not_exists
            if (docid == undefined) {
                docid = this.username + '-' + base.randomInt(10000);
                docid = format.slugify(docid);
            }

            this.stateSave = this.state;
            this.changeState('saving');

            // Default permissions to be public readable.
            if (!json.readers) {
                json.readers = ['public'];
            }

            var data = JSON.stringify(json);
            this.log('saving: ' + this.getDocURL(docid), json);
            $.ajax({
                type: 'PUT',
                url: this.getDocURL(docid),
                data: data,
                error: this.errorHandler.fnMethod(this),
                success: function() {
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

            window.location.hash = docid;
            this.lastHash = window.location.hash;
            // Chrome has a bug where the location bar is not updated unless
            // the whole thing is set.
            window.location.href = window.location.href;
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

            if (this.appBar) {
                if (this.isSaved()) {
                    $('#pfSave').addClass('disabled');
                }
                else {
                    $('#pfSave').removeClass('disabled');
                }
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

        /* Low-level storage primitives for saving and loading documents
           and blobs.

           TODO: Move putDoc, getDoc, putBlob, and setBlob into another
           module, com.pageforest.storage, and refactor client.
           */

        // Save a document - does not have to be the "main" document
        // that the user is currently viewing.
        putDoc: function (docid, json, fn) {
            if (!fn) {
                fn = function () {};
            }

            var validations = {
                'no_username': [this.username, signInMessage],
                'missing_document_name': [docid, docidMessage],
                'missing_object': [json, objectMessage],
                'missing_title': [json && json.title, titleMessage],
                'missing_blob': [json && json.blob, blobMessage]
            };

            for (var code in validations) {
                if (validations.hasOwnProperty(code)) {
                    var validation = validations[code];
                    if (!validation[0]) {
                        this.errorReport(code, validation[1]);
                        fn(false);
                        return;
                    }
                }
            }

            // Default permissions to be public readable.
            if (!json.readers) {
                json.readers = ['public'];
            }

            var data = JSON.stringify(json);
            this.log('saving document: ' + this.getDocURL(docid), json);
            $.ajax({
                type: 'PUT',
                url: this.getDocURL(docid),
                data: data,
                error: function () {
                    this.errorHandler.fnMethod(this);
                    fn(false);
                },
                success: function () {
                    fn(true);
                }
            });
        },

        // Save a child blob in the namespace of a document
        putBlob: function(docid, blobid, data, options, fn) {
            fn = fn || function () {};
            options = options || {};

            if (docid == undefined) {
                this.errorReport('unsaved_document', docUnsavedMessage);
                fn(false);
                return;
            }

            var url = this.getDocURL(docid) + blobid;
            var query_string = [];
            if (options.encoding) {
                query_string.push('transfer-encoding=' + options.encoding);
            }
            if (options.tags) {
                query_string.push('tags=' + options.tags.join(','));
            }
            query_string = query_string.join('&');
            if (query_string) {
                url += '?' + query_string;
            }

            if (typeof data != "string") {
                data = JSON.stringify(data);
            }
            this.log('saving blob: ' + url + ' (' + data.length + ')');
            $.ajax({
                type: 'PUT',
                url: url,
                data: data,
                dataType: 'json',
                processData: false,
                error: function (xmlhttp, textStatus, errorThrown) {
                    var code = 'ajax_error/' + xmlhttp.status;
                    var message = xmlhttp.statusText;
                    this.log(message + ' (' + code + ') ' + url,
                             {'obj': xmlhttp});
                    this.errorReport(code, message);
                    fn(false);
                }.fnMethod(this),
                success: function() {
                    this.log('saved blob: ' + url);
                    fn(true);
                }.fnMethod(this)
            });
        },

        // Read a child blob in the namespace of a document
        // TODO: refactor to share code with putBlob
        getBlob: function(docid, blobid, options, fn) {
            fn = fn || function () {};
            options = options || {};
            var type = 'GET';

            if (docid == undefined) {
                this.errorReport('unsaved_document', docUnsavedMessage);
                fn(false);
                return;
            }

            var url = this.getDocURL(docid) + blobid;
            if (options.encoding || options.tags) {
                url += '?';
            }
            if (options.encoding) {
                url += 'transfer-encoding=' + options.encoding;
            }
            if (options.tags) {
                var encodedTags = base.map(options.tags, encodeURIComponent);
                url += 'tags=' + encodedTags.join(',');
            }
            if (options.headOnly) {
                type = 'HEAD';
            }
            this.log('reading blob: ' + docid + '/' + blobid);
            $.ajax({
                'type': type,
                'url': url,
                // REVIEW: Is this the right default - note that 200 return
                // codes can return error because the data is NOT json!
                'dataType': options.dataType || 'json',
                'error': function (xmlhttp, textStatus, errorThrown) {
                    var code = 'ajax_error/' + xmlhttp.status;
                    var message = xmlhttp.statusText;
                    this.log(message + ' (' + code + ')', {'obj': xmlhttp});
                    this.errorReport(code, message);
                    fn(false);
                }.fnMethod(this),
                'success': function(data) {
                    this.log('read blob: ' + url);
                    fn(true, data);
                }.fnMethod(this)
            });
        },


        // Return the URL for a document or blob.
        getDocURL: function(docid, blobid) {
            if (docid == undefined) {
                docid = this.docid;
            }
            if (docid == undefined) {
                return undefined;
            }
            if (blobid == undefined) {
                blobid = '';
            }
            return 'http://' + this.appHost + '/docs/' + docid + '/' + blobid;
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
                return;
            }
            var formatted = "client error: " + message +
                ' (' + status + ')';
            this.log(formatted);
            alert(message);
        },

        // Periodically poll for changes in the URL and state of user sign-in
        // Could start loading a new document
        poll: function () {
            // Callbacks to app are deferred until poll is called.
            if (this.state == 'init') {
                if (this.app.getDoc) {
                    this.setCleanDoc(undefined, true);
                }
            }

            if (this.lastHash != window.location.hash) {
                this.lastHash = window.location.hash;
                this.load(window.location.hash.substr(1));
            }
            this.checkUsername();
            this.checkDoc();
            this.fFirstPoll = false;
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
                    this.onUserChange(this.username);
                }
            } else {
                if (this.username || this.fFirstPoll) {
                    this.username = undefined;
                    this.onUserChange(this.username);
                }
            }
        },

        onUserChange: function(username) {
            if (this.app.onUserChange) {
                this.app.onUserChange(username);
            }
            if (this.appBar) {
                var isSignedIn = username != undefined;
                if (isSignedIn) {
                    $('#pfWelcome').show();
                    $('#pfUsername')
                        .text(isSignedIn ? username : 'anonymous')
                        .show();
                } else {
                    $('#pfWelcome').hide();
                    $('#pfUsername').hide();
                }
                $('#pfSignIn').text(isSignedIn ? 'Sign Out' : 'Sign In');
            }
        },

        // Add a standard user interface to the web page.
        addAppBar: function() {
            var htmlAppBar = '<div class="pfAppBarBox">' +
                '<div class="pfLeft"></div>' +
                '<div class="pfCenter">' +
                '<span id="pfWelcome">Welcome,</span>' +
                '<span class="pfLink" id="pfUsername"></span>' +
                '<span class="pfLink" id="pfSignIn">Sign In</span>' +
                '<span class="pfLink" id="pfSave">Save</span>' +
                '<span class="pfLink" id="pfDetach">Copy</span>' +
                '<div id="pfLogo"></div>' +
                '</div><div class="pfRight"></div>' +
                '</div>';

            this.appBar = document.getElementById('pfAppBar');
            if (!this.appBar) {
                document.body.style.marginTop = "39px";
                this.appBar = document.createElement('div');
                this.appBar.setAttribute('id', 'pfAppBar');
                this.appBar.style.position = 'absolute';
                this.appBar.style.top = '0';
                this.appBar.style.left = '0';
                document.body.appendChild(this.appBar);

                console.log($('#pfSignIn'));
            }

            this.appBar.innerHTML = htmlAppBar;
            var self = this;

            $('#pfSignIn').bind('click', function () {
                self.signInOut();
            });

            $('#pfSave').bind('click', function() {
                self.save();
            });

            $('#pfDetach').bind('click', function() {
                self.detach();
            });

            $('#pfLogo').bind('click', function() {
                window.open('http://' + self.wwwHost);
            });
        },

        // Sign in (or out) depending on current user state.
        signInOut: function() {
            console.log("sign in/out");
            var isSignedIn = this.username != undefined;
            if (isSignedIn) {
                this.signOut();
            }
            else {
                this.signIn();
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
