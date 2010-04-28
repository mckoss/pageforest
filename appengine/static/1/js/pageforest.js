/* Begin file: namespace.js */
/* Namespace.js

   Version 1.0, June 2009
   by Mike Koss - released into the public domain.

   Support for building modular namespaces in javascript.

   Globals:

   window.global_namespace (Namespace) - The top of the namespace hierarchy.
   Child namespaces are stored as properties in each namespace object.

   *** Class Namespace ***

   Methods:

   ns.define(sPath, fnCallback(ns)) - Define a new Namespace object
   and call the provided function with the new namespace as a
   parameter. Returns the newly defined namespace. sPath has the form
   ('unique.module.sub_module').

   ns.extend(oDest, oSource) - Copy the (own) properties of the source
   object into the destination object. Returns oDest. Note: This
   method is a convenience function - it has no effect on the
   Namespace object itself.

   ns.import(sPath) - Return the namespace object with the given path.

   Usage example:

   global_namespace.define('org.startpad.base', function(ns) {
       var Other = ns.Import('org.startpad.other');

       ns.extend(ns, {
           var1: value1,
           var2: value2,
           myFunc: function(args) {
               ...Other.AFunction(args)...
           }
       });

       ns.ClassName = function(args) {
       };

       ns.ClassName.prototype = {
           constructor: ns.ClassName,
           var1: value1,

           method1: function(args) {
           }
       };
   });
*/

// Define stubs for FireBug objects if not present.
// This is here because this will often be the first javascript file loaded.
if (!window.console) {
    (function () {
        var noop = function () {};
        var names = ["log", "debug", "info", "warn", "error", "assert",
                     "dir", "dirxml", "group", "groupEnd", "time", "timeEnd",
                     "count", "trace", "profile", "profileEnd"];
        window.console = {};
        for (var i = 0; i < names.length; ++i) {
            window.console[names[i]] = noop;
        }
    }());
}

(function () {
    var sGlobal = 'global_namespace';

    // Don't run this function more than once.
    if (window[sGlobal]) {
        return;
    }

    /** @constructor **/
    function Namespace(nsParent, sName) {
        if (sName) {
            sName = sName.replace(/-/g, '_');
        }

        this._nsParent = nsParent;

        if (this._nsParent) {
            this._nsParent[sName] = this;
            this._sPath = this._nsParent._sPath;
            if (this._sPath !== '') {
                this._sPath += '.';
            }
            this._sPath += sName;
        } else {
            this._sPath = '';
        }
    }

    Namespace.prototype.extend = function (oDest, var_args) {
        if (oDest === undefined) {
            oDest = {};
        }

        for (var i = 1; i < arguments.length; i++) {
            var oSource = arguments[i];
            for (var prop in oSource) {
                if (oSource.hasOwnProperty(prop)) {
                    oDest[prop] = oSource[prop];
                }
            }
        }

        return oDest;
    };

    var ns = window[sGlobal] = new Namespace(null);

    ns.extend(Namespace.prototype, {
        define: function (sPath, fnCallback) {
            sPath = sPath.replace(/-/g, '_');

            var aPath = sPath.split('.');
            var nsCur = this;
            for (var i = 0; i < aPath.length; i++) {
                var sName = aPath[i];
                if (nsCur[sName] === undefined) {
                    var nsNew = new Namespace(nsCur, sName);
                }
                nsCur = nsCur[sName];
            }
            // In case a namespace is multiply loaded, we ignore the
            // definition function for all but the first call.
            if (fnCallback) {
                if (!nsCur._fDefined) {
                    nsCur._fDefined = true;
                    fnCallback(nsCur);
                    // console.info("Namespace '" + nsCur._sPath +
                    //              "' defined.");
                } else {
                    console.warn("WARNING: Namespace '" + nsCur._sPath +
                                 "' redefinition.");
                }
            } else if (!nsCur._fDefined) {
                console.warn("Namespace '" + nsCur._sPath +
                             "' forward reference.");
            }
            return nsCur;
        },

        lookup: function (sPath) {
            return window[sGlobal].define(sPath);
        },

        nameOf: function (sInNamespace) {
            sInNamespace = sInNamespace.replace(/-/g, '_');
            return sGlobal + '.' + this._sPath + '.' + sInNamespace;
        },

        isOwn: function (object, name) {
            return Object.prototype.hasOwnProperty.call(object, name);
        }
    });
}());
/* Begin file: json2.js */
/*
    http://www.JSON.org/json2.js
    2010-03-20

    2010-04-14: Updated, changed namespace to org.json.json2
    2009-06-22: Modified by Mike Koss to place in global_namespace.JSON

    Public Domain.

    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

    See http://www.JSON.org/js.html


    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html

    USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
    NOT CONTROL.


    This file creates a global JSON object containing two methods: stringify
    and parse.

        JSON.stringify(value, replacer, space)
            value       any JavaScript value, usually an object or array.

            replacer    an optional parameter that determines how object
                        values are stringified for objects. It can be a
                        function or an array of strings.

            space       an optional parameter that specifies the indentation
                        of nested structures. If it is omitted, the text will
                        be packed without extra whitespace. If it is a number,
                        it will specify the number of spaces to indent at each
                        level. If it is a string (such as '\t' or '&nbsp;'),
                        it contains the characters used to indent at each level.

            This method produces a JSON text from a JavaScript value.

            When an object value is found, if the object contains a toJSON
            method, its toJSON method will be called and the result will be
            stringified. A toJSON method does not serialize: it returns the
            value represented by the name/value pair that should be serialized,
            or undefined if nothing should be serialized. The toJSON method
            will be passed the key associated with the value, and this will be
            bound to the value

            For example, this would serialize Dates as ISO strings.

                Date.prototype.toJSON = function (key) {
                    function f(n) {
                        // Format integers to have at least two digits.
                        return n < 10 ? '0' + n : n;
                    }

                    return this.getUTCFullYear()   + '-' +
                         f(this.getUTCMonth() + 1) + '-' +
                         f(this.getUTCDate())      + 'T' +
                         f(this.getUTCHours())     + ':' +
                         f(this.getUTCMinutes())   + ':' +
                         f(this.getUTCSeconds())   + 'Z';
                };

            You can provide an optional replacer method. It will be passed the
            key and value of each member, with this bound to the containing
            object. The value that is returned from your method will be
            serialized. If your method returns undefined, then the member will
            be excluded from the serialization.

            If the replacer parameter is an array of strings, then it will be
            used to select the members to be serialized. It filters the results
            such that only members with keys listed in the replacer array are
            stringified.

            Values that do not have JSON representations, such as undefined or
            functions, will not be serialized. Such values in objects will be
            dropped; in arrays they will be replaced with null. You can use
            a replacer function to replace those with JSON values.
            JSON.stringify(undefined) returns undefined.

            The optional space parameter produces a stringification of the
            value that is filled with line breaks and indentation to make it
            easier to read.

            If the space parameter is a non-empty string, then that string will
            be used for indentation. If the space parameter is a number, then
            the indentation will be that many spaces.

            Example:

            text = JSON.stringify(['e', {pluribus: 'unum'}]);
            // text is '["e",{"pluribus":"unum"}]'


            text = JSON.stringify(['e', {pluribus: 'unum'}], null, '\t');
            // text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

            text = JSON.stringify([new Date()], function (key, value) {
                return this[key] instanceof Date ?
                    'Date(' + this[key] + ')' : value;
            });
            // text is '["Date(---current time---)"]'


        JSON.parse(text, reviver)
            This method parses a JSON text to produce an object or array.
            It can throw a SyntaxError exception.

            The optional reviver parameter is a function that can filter and
            transform the results. It receives each of the keys and values,
            and its return value is used instead of the original value.
            If it returns what it received, then the structure is not modified.
            If it returns undefined then the member is deleted.

            Example:

            // Parse the text. Values that look like ISO date strings will
            // be converted to Date objects.

            myData = JSON.parse(text, function (key, value) {
                var a;
                if (typeof value === 'string') {
                    a =
/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
                    if (a) {
                        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
                            +a[5], +a[6]));
                    }
                }
                return value;
            });

            myData = JSON.parse('["Date(09/09/2001)"]', function (key, value) {
                var d;
                if (typeof value === 'string' &&
                        value.slice(0, 5) === 'Date(' &&
                        value.slice(-1) === ')') {
                    d = new Date(value.slice(5, -1));
                    if (d) {
                        return d;
                    }
                }
                return value;
            });


    This is a reference implementation. You are free to copy, modify, or
    redistribute.
*/

/*jslint evil: true, strict: false */
/*global global_namespace */

/*x-members "", "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
    call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
    getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
    lastIndex, length, parse, prototype, push, replace, slice, stringify,
    test, toJSON, toString, valueOf
*/


// Create a JSON object only if one does not already exist. We create the
// methods in a closure to avoid creating global variables.

global_namespace.define('org.json.json2', function(JSON) {

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    if (typeof Date.prototype.toJSON !== 'function') {

        Date.prototype.toJSON = function (key) {

            return isFinite(this.valueOf()) ?
                   this.getUTCFullYear()   + '-' +
                 f(this.getUTCMonth() + 1) + '-' +
                 f(this.getUTCDate())      + 'T' +
                 f(this.getUTCHours())     + ':' +
                 f(this.getUTCMinutes())   + ':' +
                 f(this.getUTCSeconds())   + 'Z' : null;
        };

        String.prototype.toJSON =
        Number.prototype.toJSON =
        Boolean.prototype.toJSON = function (key) {
            return this.valueOf();
        };
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

        escapable.lastIndex = 0;
        return escapable.test(string) ?
            '"' + string.replace(escapable, function (a) {
                var c = meta[a];
                return typeof c === 'string' ? c :
                    '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' :
            '"' + string + '"';
    }


    function str(key, holder) {

// Produce a string from holder[key].

        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

        if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

// What happens next depends on the value's type.

        switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

            return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

        case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

            if (!value) {
                return 'null';
            }

// Make an array to hold the partial results of stringifying this object value.

            gap += indent;
            partial = [];

// Is the value an array?

            if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

                v = partial.length === 0 ? '[]' :
                    gap ? '[\n' + gap +
                            partial.join(',\n' + gap) + '\n' +
                                mind + ']' :
                          '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }

// If the replacer is an array, use it to select the members to be stringified.

            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    k = rep[i];
                    if (typeof k === 'string') {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {

// Otherwise, iterate through all of the keys in the object.

                for (k in value) {
                    if (Object.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

            v = partial.length === 0 ? '{}' :
                gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' +
                        mind + '}' : '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }

// If the JSON object does not yet have a stringify method, give it one.

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

            var i;
            gap = '';
            indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }

// If the space parameter is a string, it will be used as the indent string.

            } else if (typeof space === 'string') {
                indent = space;
            }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                     typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

            return str('', {'': value});
        };
    }


// If the JSON object does not yet have a parse method, give it one.

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

            var j;

            function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

            text = String(text);
            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with '()' and 'new'
// because they can cause invocation, and '=' because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

            if (/^[\],:{}\s]*$/.
test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').
replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                j = eval('(' + text + ')');

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

                return typeof reviver === 'function' ?
                    walk({'': j}, '') : j;
            }

// If the text is not JSON parseable, then a SyntaxError is thrown.

            throw new SyntaxError('JSON.parse');
        };
    }

}); // org.json.json2
/* Begin file: crypto.js */
/*!
 * Crypto-JS v2.0.0
 * http://code.google.com/p/crypto-js/
 * Copyright (c) 2009, Jeff Mott. All rights reserved.
 * http://code.google.com/p/crypto-js/wiki/License
 */

// 2010-04-20 Added global_namespace - johann@rocholl.net

global_namespace.define("com.googlecode.crypto-js", function () {});

(function(){

var base64map = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Global Crypto object
var Crypto = global_namespace.lookup("com.googlecode.crypto-js");


// Crypto utilities
var util = Crypto.util = {

    // Bit-wise rotate left
    rotl: function (n, b) {
        return (n << b) | (n >>> (32 - b));
    },

    // Bit-wise rotate right
    rotr: function (n, b) {
        return (n << (32 - b)) | (n >>> b);
    },

    // Swap big-endian to little-endian and vice versa
    endian: function (n) {

        // If number given, swap endian
        if (n.constructor == Number) {
            return util.rotl(n,  8) & 0x00FF00FF |
                   util.rotl(n, 24) & 0xFF00FF00;
        }

        // Else, assume array and swap all items
        for (var i = 0; i < n.length; i++)
            n[i] = util.endian(n[i]);
        return n;

    },

    // Generate an array of any length of random bytes
    randomBytes: function (n) {
        for (var bytes = []; n > 0; n--)
            bytes.push(Math.floor(Math.random() * 256));
        return bytes;
    },

    // Convert a byte array to big-endian 32-bit words
    bytesToWords: function (bytes) {
        for (var words = [], i = 0, b = 0; i < bytes.length; i++, b += 8)
            words[b >>> 5] |= bytes[i] << (24 - b % 32);
        return words;
    },

    // Convert big-endian 32-bit words to a byte array
    wordsToBytes: function (words) {
        for (var bytes = [], b = 0; b < words.length * 32; b += 8)
            bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF);
        return bytes;
    },

    // Convert a byte array to a hex string
    bytesToHex: function (bytes) {
        for (var hex = [], i = 0; i < bytes.length; i++) {
            hex.push((bytes[i] >>> 4).toString(16));
            hex.push((bytes[i] & 0xF).toString(16));
        }
        return hex.join("");
    },

    // Convert a hex string to a byte array
    hexToBytes: function (hex) {
        for (var bytes = [], c = 0; c < hex.length; c += 2)
            bytes.push(parseInt(hex.substr(c, 2), 16));
        return bytes;
    },

    // Convert a byte array to a base-64 string
    bytesToBase64: function (bytes) {

        // Use browser-native function if it exists
        if (typeof btoa == "function") return btoa(Binary.bytesToString(bytes));

        for(var base64 = [], i = 0; i < bytes.length; i += 3) {
            var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
            for (var j = 0; j < 4; j++) {
                if (i * 8 + j * 6 <= bytes.length * 8)
                    base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F));
                else base64.push("=");
            }
        }

        return base64.join("");

    },

    // Convert a base-64 string to a byte array
    base64ToBytes: function (base64) {

        // Use browser-native function if it exists
        if (typeof atob == "function") return Binary.stringToBytes(atob(base64));

        // Remove non-base-64 characters
        base64 = base64.replace(/[^A-Z0-9+\/]/ig, "");

        for (var bytes = [], i = 0, imod4 = 0; i < base64.length; imod4 = ++i % 4) {
            if (imod4 == 0) continue;
            bytes.push(((base64map.indexOf(base64.charAt(i - 1)) & (Math.pow(2, -2 * imod4 + 8) - 1)) << (imod4 * 2)) |
                       (base64map.indexOf(base64.charAt(i)) >>> (6 - imod4 * 2)));
        }

        return bytes;

    }

};

// Crypto mode namespace
Crypto.mode = {};

// Crypto character encodings
var charenc = Crypto.charenc = {};

// UTF-8 encoding
var UTF8 = charenc.UTF8 = {

    // Convert a string to a byte array
    stringToBytes: function (str) {
        return Binary.stringToBytes(unescape(encodeURIComponent(str)));
    },

    // Convert a byte array to a string
    bytesToString: function (bytes) {
        return decodeURIComponent(escape(Binary.bytesToString(bytes)));
    }

};

// Binary encoding
var Binary = charenc.Binary = {

    // Convert a string to a byte array
    stringToBytes: function (str) {
        for (var bytes = [], i = 0; i < str.length; i++)
            bytes.push(str.charCodeAt(i));
        return bytes;
    },

    // Convert a byte array to a string
    bytesToString: function (bytes) {
        for (var str = [], i = 0; i < bytes.length; i++)
            str.push(String.fromCharCode(bytes[i]));
        return str.join("");
    }

};

})();

//////////////////////////////// sha1.js /////////////////////////////////

(function(){

// Shortcuts
var C = global_namespace.lookup("com.googlecode.crypto-js"),
    util = C.util,
    charenc = C.charenc,
    UTF8 = charenc.UTF8,
    Binary = charenc.Binary;

// Public API
var SHA1 = C.SHA1 = function (message, options) {
    var digestbytes = util.wordsToBytes(SHA1._sha1(message));
    return options && options.asBytes ? digestbytes :
           options && options.asString ? Binary.bytesToString(digestbytes) :
           util.bytesToHex(digestbytes);
};

// The core
SHA1._sha1 = function (message) {

    // Convert to byte array
    if (message.constructor == String) message = UTF8.stringToBytes(message);
    /* else, assume byte array already */

    var m  = util.bytesToWords(message),
        l  = message.length * 8,
        w  =  [],
        H0 =  1732584193,
        H1 = -271733879,
        H2 = -1732584194,
        H3 =  271733878,
        H4 = -1009589776;

    // Padding
    m[l >> 5] |= 0x80 << (24 - l % 32);
    m[((l + 64 >>> 9) << 4) + 15] = l;

    for (var i = 0; i < m.length; i += 16) {

        var a = H0,
            b = H1,
            c = H2,
            d = H3,
            e = H4;

        for (var j = 0; j < 80; j++) {

            if (j < 16) w[j] = m[i + j];
            else {
                var n = w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16];
                w[j] = (n << 1) | (n >>> 31);
            }

            var t = ((H0 << 5) | (H0 >>> 27)) + H4 + (w[j] >>> 0) + (
                     j < 20 ? (H1 & H2 | ~H1 & H3) + 1518500249 :
                     j < 40 ? (H1 ^ H2 ^ H3) + 1859775393 :
                     j < 60 ? (H1 & H2 | H1 & H3 | H2 & H3) - 1894007588 :
                              (H1 ^ H2 ^ H3) - 899497514);

            H4 =  H3;
            H3 =  H2;
            H2 = (H1 << 30) | (H1 >>> 2);
            H1 =  H0;
            H0 =  t;

        }

        H0 += a;
        H1 += b;
        H2 += c;
        H3 += d;
        H4 += e;

    }

    return [H0, H1, H2, H3, H4];

};

// Package private blocksize
SHA1._blocksize = 16;

})();

//////////////////////////////// hmac.js /////////////////////////////////

(function(){

// Shortcuts
var C = global_namespace.lookup("com.googlecode.crypto-js"),
    util = C.util,
    charenc = C.charenc,
    UTF8 = charenc.UTF8,
    Binary = charenc.Binary;

C.HMAC = function (hasher, message, key, options) {

    // Convert to byte arrays
    if (message.constructor == String) message = UTF8.stringToBytes(message);
    if (key.constructor == String) key = UTF8.stringToBytes(key);
    /* else, assume byte arrays already */

    // Allow arbitrary length keys
    if (key.length > hasher._blocksize * 4)
        key = hasher(key, { asBytes: true });

    // XOR keys with pad constants
    var okey = key.slice(0),
        ikey = key.slice(0);
    for (var i = 0; i < hasher._blocksize * 4; i++) {
        okey[i] ^= 0x5C;
        ikey[i] ^= 0x36;
    }

    var hmacbytes = hasher(okey.concat(hasher(ikey.concat(message), { asBytes: true })), { asBytes: true });

    return options && options.asBytes ? hmacbytes :
           options && options.asString ? Binary.bytesToString(hmacbytes) :
           util.bytesToHex(hmacbytes);

};

})();

///////////////////// Convenience functions //////////////////////////////

(function(){

    var C = global_namespace.lookup("com.googlecode.crypto-js");

    // ATTENTION: This uses standard argument order
    // (key first) even though C.HMAC has it wrong.
    C.HMAC_SHA1 = function (key, message, options) {
        return C.HMAC(C.SHA1, message, key, options);
    };

})();
/* Begin file: registration.js */
global_namespace.define('com.pageforest.registration', function(ns) {

    function html_message(name, message) {
        if ($("#id_" + name).val() === '') {
            return '';
        }
        if (message) {
            return '<span class="error">' + message + '</span>';
        }
        return '<span class="success">OK</span>';
    }

    function validate_success(message, status, xhr) {
        var fields = {"username": "username", "email": "email",
                      "password": "password", "repeat": "__all__"};
        for (var name in fields) {
            if (ns.isOwn(fields, name)) {
                $("#validate_" + name).html(
                    html_message(name, message[fields[name]]));
            }
        }
    }

    function validate_error(xhr, status, message) {
        console.error(xhr);
    }

    function validate_if_changed() {
        var data = {
            username: $("#id_username").val(),
            email: $("#id_email").val(),
            password: $("#id_password").val(),
            repeat: $("#id_repeat").val(),
            tos: true
        };
        var oneline = [data.username, data.email,
                       data.password, data.repeat];
        oneline = oneline.join('~');
        if (oneline == ns.previous) {
            return;
        }
        ns.previous = oneline;
        console.log(oneline);
        $.ajax({
            type: "POST",
            url: "/auth/register/validate/",
            data: data,
            dataType: "json",
            success: validate_success,
            error: validate_error
        });
    }

    ns.document_ready = function () {
        ns.previous = '~~~';
        setInterval(validate_if_changed, 1000);  // Once per second.
    };

}); // com.pageforest.registration
/* Begin file: formatutil.js */
global_namespace.define('org.startpad.format-util', function(NS) {

NS.extend(NS, {
// Convert and digits in d to thousand-separated digits
Thousands: function(d)
    {
    var s = d.toString();
    var sLast = "";
    while (s != sLast)
        {
        sLast = s;
        s = s.replace(/(\d+)(\d{3})/, "$1,$2");
        }
    return s;
    },

// Converts to lowercase, removes non-alpha chars and converts spaces to hyphens"
Slugify: function(s)
    {
    s = s.Trim().toLowerCase();
    s = s.replace(/[^\w\s-]/g, '-')
        .replace(/[-\s]+/g, '-')
        .replace(/(^-+)|(-+$)/g, '');
    return s;
    },

FormatNumber: function(val, digits)
    {
    var nInt = Math.floor(val);
    var sInt = nInt.toString();
    var sLast = "";
    while (sInt != sLast)
        {
        sLast = sInt;
        sInt = sInt.replace(/(\d+)(\d{3})/, "$1,$2");
        }

    if (digits && digits > 0)
        {
        var nFrac = val - nInt;
        nFrac = Math.floor(nFrac * Math.pow(10,digits));
        sFrac = "." + SDigits(nFrac, digits);
        }
    else
        sFrac = "";

    return sInt + sFrac;
    },

// Return an integer as a string using a fixed number of digits, c. (require a sign with fSign).
SDigits: function(val, c, fSign)
    {
    var s = "";
    var fNeg = (val < 0);

    if (c == undefined)
        c = 0;

    if (fNeg)
        val = -val;

    val = Math.floor(val);

    for (; c > 0; c--)
        {
        s = (val%10) + s;
        val = Math.floor(val/10);
        }

    if (fSign || fNeg)
        s = (fNeg ? "-" : "+") + s;

    return s;
    },

EscapeHTML: function(s)
    {
    s = s.toString();
    s = s.replace(/&/g, '&amp;');
    s = s.replace(/</g, '&lt;');
    s = s.replace(/>/g, '&gt;');
    s = s.replace(/\"/g, '&quot;');
    s = s.replace(/'/g, '&#39;');
    return s;
    },

// Replace keys in dictionary of for {key} in the text string.
ReplaceKeys: function(st, keys)
    {
    for (var key in keys)
        st = st.StReplace("{" + key + "}", keys[key]);
    st = st.replace(/\{[^\{\}]*\}/g, "");
    return st;
    }

});

//--------------------------------------------------------------------------
// Some extensions to built-in JavaScript objects (sorry!)
//--------------------------------------------------------------------------

String.prototype.Trim = function()
{
    return (this || "").replace( /^\s+|\s+$/g, "");
};

String.prototype.StReplace = function(stPat, stRep)
{

    var st = "";
    if (stRep == undefined)
        stRep = "";
    else
        stRep = stRep.toString();

    var ich = 0;
    var ichFind = this.indexOf(stPat, 0);

    while (ichFind >= 0)
        {
        st += this.substring(ich, ichFind) + stRep;
        ich = ichFind + stPat.length;
        ichFind = this.indexOf(stPat, ich);
        }
    st += this.substring(ich);

    return st;
};

}); // startpad.format-util
/* Begin file: dateutil.js */
global_namespace.define('org.startpad.date-util', function(NS) {
    var Base = NS.lookup('org.startpad.base');
    var Format = NS.lookup('org.startpad.format-util');

//--------------------------------------------------------------------------
// ISO 8601 Date Formatting
// YYYY-MM-DDTHH:MM:SS.sssZ (where Z could be +HH or -HH for non UTC)
// Note that dates are inherently stored at UTC dates internally.  But we infer that they
// denote local times by default.  If the dt.__tz exists, it is assumed to be an integer number
// of hours offset to the timezone for which the time is to be indicated (e.g., PST = -08).
// Callers should set dt.__tz = 0 to fix the date at UTC.  All other times are adjusted to
// designate the local timezone.
//--------------------------------------------------------------------------

NS.ISO = {
    tz: -(new Date().getTimezoneOffset())/60,  // Default timezone = local timezone
    enumMatch: new Base.Enum([1, "YYYY", "MM", "DD", 5, "hh", "mm", 8, "ss", 10, "sss", "tz"]),

FromDate: function(dt, fTime)
    {
    var dtT = new Date();
    dtT.setTime(dt.getTime());
    var tz = dt.__tz;
    if (tz == undefined)
        tz = NS.ISO.tz;

    // Adjust the internal (UTC) time to be the local timezone (add tz hours)
    // Note that setTime() and getTime() are always in (internal) UTC time.
    if (tz)
        dtT.setTime(dtT.getTime() + 60*60*1000 * tz);

    var s = dtT.getUTCFullYear() + "-" + Format.SDigits(dtT.getUTCMonth()+1,2) + "-" + Format.SDigits(dtT.getUTCDate(),2);
    var ms = dtT % (24*60*60*1000);
    if (ms || fTime || tz != 0)
        {
        s += "T" + Format.SDigits(dtT.getUTCHours(),2) + ":" + Format.SDigits(dtT.getUTCMinutes(),2);
        ms = ms % (60*1000);
        if (ms)
            s += ":" + Format.SDigits(dtT.getUTCSeconds(),2);
        if (ms % 1000)
            s += "." + Format.SDigits(dtT.getUTCMilliseconds(), 3);
        if (tz == 0)
            s += "Z";
        else
            s += Format.SDigits(tz, 2, true);
        }
    return s;
    },

//--------------------------------------------------------------------------
// Parser is more lenient than formatter.  Punctuation between date and time parts is optional.
// We require at the minimum, YYYY-MM-DD.  If a time is given, we require at least HH:MM.
// YYYY-MM-DDTHH:MM:SS.sssZ as well as YYYYMMDDTHHMMSS.sssZ are both acceptable.
// Note that YYYY-MM-DD is ambiguous.  Without a timezone indicator we don't know if this is a
// UTC midnight or Local midnight.  We default to UTC midnight (the FromDate function always
// write out non-UTC times so we can append the time zone).
// Fractional seconds can be from 0 to 6 digits (microseconds maximum)
//--------------------------------------------------------------------------
ToDate: function(sISO, objExtra)
    {
    var e = NS.ISO.enumMatch;
    var aParts = sISO.match(/^(\d{4})-?(\d\d)-?(\d\d)(T(\d\d):?(\d\d):?((\d\d)(\.(\d{0,6}))?)?(Z|[\+-]\d\d))?$/);
    if (!aParts)
        return undefined;

    aParts[e.mm] = aParts[e.mm] || 0;
    aParts[e.ss] = aParts[e.ss] || 0;
    aParts[e.sss] = aParts[e.sss] || 0;
    // Convert fractional seconds to milliseconds
    aParts[e.sss] = Math.round(+('0.'+aParts[e.sss])*1000);
    if (!aParts[e.tz] || aParts[e.tz] === "Z")
        aParts[e.tz] = 0;
    else
        aParts[e.tz] = parseInt(aParts[e.tz]);

    // Out of bounds checking - we don't check days of the month is correct!
    if (aParts[e.MM] > 59 || aParts[e.DD] > 31 || aParts[e.hh] > 23 || aParts[e.mm] > 59 || aParts[e.ss] > 59 ||
        aParts[e.tz] < -23 || aParts[e.tz] > 23)
        return undefined;

    var dt = new Date();
    dt.setUTCFullYear(aParts[e.YYYY], aParts[e.MM]-1, aParts[e.DD]);
    if (aParts[e.hh])
        {
        dt.setUTCHours(aParts[e.hh], aParts[e.mm], aParts[e.ss], aParts[e.sss]);
        }
    else
        dt.setUTCHours(0,0,0,0);

    // BUG: For best compatibility - could set tz to undefined if it is our local tz
    // Correct time to UTC standard (utc = t - tz)
    dt.__tz = aParts[e.tz];
    if (aParts[e.tz])
        dt.setTime(dt.getTime() - dt.__tz * (60*60*1000));
    if (objExtra)
        NS.Extend(dt, objExtra);
    return dt;
    }
};  // NS.ISO
}); // startpad.date-util
/* Begin file: data.js */
global_namespace.define('org.startpad.data', function(NS) {
    var DateUtil = NS.lookup('org.startpad.date-util');
    var Timer = NS.lookup('org.startpad.timer');
    var JSON = NS.lookup('org.json.json2');
    var Base = NS.lookup('org.startpad.base');
    var Event = NS.lookup('org.startpad.events');
    var Format = NS.lookup('org.startpad.format-util');

NS.extend(NS, {
    sSiteName: "web",
    apikey: undefined,
    sid: undefined,
    afn: [],
    ifn: 1,
    mMessages: {
        errBusy: "Call made while another call is in progress."
        },

SetSiteName: function(sName)
    {
    NS.sSiteName = sName;
    },

GetAPIKey: function(sDomain, fnNext)
    {
    if (NS.apikey != undefined)
        return fnNext();

    new NS.ScriptData("http://" + sDomain + "/init.json").Call({}, function (obj)
        {
        if (obj.status != "OK")
            {
            alert(obj.message);
            return;
            }
        NS.apikey = obj.apikey;
        NS.sid = obj.sid;
        fnNext();
        });
    },

// Convert all top-level object properties into a URL query string.
// {a:1, b:"hello, world"} -> "?a=1&b=hello%2C%20world"
// Date's are convered to ISO-8601 formatted date strings
StParams: function(obj)
    {
    if (obj === undefined || obj === null)
        {
        return "";
        }

    var stDelim = "?";
    var stParams = "";
    for (var prop in obj)
        {
        var sVal;

        if (!obj.hasOwnProperty(prop) || obj[prop] === undefined || obj[prop] == null)
            continue;

        stParams += stDelim;
        stParams += encodeURIComponent(prop);

        if (typeof obj[prop] == "object")
            {
            if (obj[prop].constructor === Date)
                sVal = DateUtil.ISO.FromDate(obj[prop]);
            else
                sVal = JSON.stringify(obj[prop]);
            }
        else
            sVal = obj[prop].toString();

        stParams += "=" + encodeURIComponent(sVal);
        stDelim = "&";
        }
    if (obj._anchor)
        {
        stParams += "#" + encodeURIComponent(obj._anchor);
        }
    return stParams;
    },

ParseParams: function(stURL)
    {
    var rgQuery = stURL.match(/([^?#]*)(#.*)?$/);
    if (!rgQuery)
        {
        return {};
        }
    var objParse = {};

    if (rgQuery[2])
        {
        objParse._anchor = decodeURIComponent(rgQuery[2].substring(1));
        }

    var rgParams = rgQuery[1].split("&");
    for (var i = 0; i < rgParams.length; i++)
        {
        var ich = rgParams[i].indexOf("=");
        var stName;
        var stValue;
        if (ich === -1)
            {
            stName = rgParams[i];
            stValue = "";
            continue;
            }
        else
            {
            stName = rgParams[i].substring(0, ich);
            stValue = rgParams[i].substring(ich+1);
            }
        objParse[decodeURIComponent(stName)] = decodeURIComponent(stValue);
        }

    return objParse;
    }
});

//--------------------------------------------------------------------------
// Cross-site JSON protocol helpers (GET and POST versions)
//--------------------------------------------------------------------------

NS.ScriptData = function(stURL, fnCallback)
{
    this.stURL = stURL;
    this.fnCallback= fnCallback;
    this.rid = 0;
    this.fInCall = false;
    this.Activate();
    return this;
};

NS.ScriptData.prototype = {
    constructor:NS.ScriptData,
    rid: 0,
    msTimeout: 10000,
    cchMax: 1000, // Max size for GET - fallback to POST

Activate: function()
    {
    if (this.rid != 0)
        return;

       this.rid = NS.ifn++;
    NS.afn[this.rid] = this;
    },

Call: function(objParams, fnCallback)
    {
    this.Activate();

    if (this.fInCall)
        throw(new Error(NS.mMessages.errBusy));
    this.fInCall = true;

    Base.ExtendMissing(objParams, {apikey:NS.apikey});

    if (fnCallback)
        this.fnCallback = fnCallback;

    if (objParams === undefined)
        objParams = {};

    objParams.callback = this.CallbackName();
    this.script = document.createElement('script');
    this.script.src = this.stURL + NS.StParams(objParams);

    // Long posts use the (more cumbersome) POST method to send data to the server
    // TODO: re-use the current call object if fallback to POST?
    if (this.script.src.length > this.cchMax)
        {
        var pd = new NS.PostData(this.stURL, this.fnCallback);
        pd.Call(objParams);
        this.Cancel();
        return;
        }

    this.tm = new Timer.Timer(this.msTimeout, this.Timeout.FnMethod(this)).Active(true);
    this.dCall = new Date();
    document.body.appendChild(this.script);
    console.info("script[" + this.rid + "]: " + this.script.src);
    return this;
    },

CallbackName: function()
    {
    return NS.SGlobalName("afn") + "[" + this.rid + "].Callback";
    },

Callback: function()
    {
    var rid = this.rid;
    this.Cancel();
    console.info("(" + rid + ") -> ", arguments);
    if (this.fnCallback)
        this.fnCallback.apply(undefined, arguments);
    },

Timeout: function()
    {
    var rid = this.rid;
    console.info("(" + rid + ") -> TIMEOUT");
    this.Cancel();
    if (this.fnCallback)
        this.fnCallback({status:"Fail/Timeout", message:"The " + NS.sSiteName + " server failed to respond."});
    },

// ScriptData can be re-used once complete
Cancel: function()
    {
    NS.ScriptData.Cancel(this.rid);
    }
}; //NS.ScriptData

NS.ScriptData.Cancel = function(rid)
{
    if (rid == 0)
        return;

    var sd = NS.afn[rid];
    NS.afn[rid] = undefined;
    // Guard against multiple calls to Cancel (sd may be reused)
    if (sd && sd.rid == rid)
        {
        sd.rid = 0;
        sd.fInCall = false;
        if (sd.tm)
            sd.tm.Active(false);
        }
};

// PostData supports cross-site data uploading
// An embedded IFRAME is added to the page, into which a FORM POST query is embedded
//
// TODO: can I create a Pool of PostData objects and re-use?

NS.PostData = function(stURL, fnCallback)
{
    this.stURL = stURL;
    this.fnCallback = fnCallback;
    return this;
};

NS.PostData.prototype = {
    constructor: NS.PostData,
    msTimeout: 10000,

Call: function(objParams, fnCallback)
    {
    if (fnCallback)
        this.fnCallback = fnCallback;

    Base.ExtendMissing(objParams, {apikey:NS.apikey});

    var reDomain = /^http:\/\/[^\/]+/;
    var sDomain = '';
    var aDomain = reDomain.exec(this.stURL);
    if (aDomain != null)
        sDomain = aDomain[0];
    var sGetResult = sDomain + '/get-result.json';

    this.sd = new NS.ScriptData(sGetResult, this.fnCallback);

    if (objParams === undefined)
        objParams = {};
    objParams.rid = this.sd.rid;
    objParams.sid = NS.sid;
    objParams.callback = this.sd.CallbackName();

    this.iframe = document.createElement("iframe");
    this.iframe.style.width = "0px";
    this.iframe.style.height = "0px";
    this.iframe.style.border = "0px";
    document.body.appendChild(this.iframe);
    this.doc = this.iframe.contentDocument || this.iframe.contentWindow.document;

    console.info("post[" + this.sd.rid + "]: " + this.stURL);

    var stb = new Base.StBuf();
    stb.Append("<html><body><form name=\"PostData\" action=\"" + this.stURL + "\" method=\"post\">");
    for (var prop in objParams)
        {
        var sValue;
        if (!objParams.hasOwnProperty(prop))
            continue;
        stb.Append("<input type=\"text\" name=\"" + prop + "\" value='");

        if (typeof objParams[prop] == 'object')
            {
            if (objParams[prop].constructor === Date)
                sValue = DateUtil.ISO.FromDate(objParams[prop]);
            else
                sValue = JSON.stringify(objParams[prop]);
            }
        else
            {
            sValue = Format.EscapeHTML(objParams[prop]);
            }
        stb.Append(sValue);
        stb.Append("'>");
        console.info("    " + prop + ": " + sValue);
        }

    stb.Append("</input></form></body></html>");

    Event.AddEventFn(this.iframe, "load", this.Loaded.FnMethod(this).FnArgs(this.rid));
    // this.doc.body.innerHTML does NOT work on IE.
    this.doc.write(stb.toString());

    this.tm = new Timer.Timer(this.msTimeout, this.Timeout.FnMethod(this)).Active(true);
    this.msCallStart = new Date().getTime();
    this.doc.PostData.submit();
    },

Loaded: function(evt)
    {
    this.tm.Active(false);
    this.msResponse = new Date().getTime() - this.msCallStart;
    console.info("(" + this.sd.rid + ") -> POST COMPLETE " + this.msResponse + " ms");

    this.sd.Call({sid: NS.sid, ridPost:this.sd.rid});
    },

Timeout: function()
    {
    // Note that this.sd.Call was never called - but we have it bound to the corrent
    // callback for a timeout call.
    this.sd.Timeout();
    },

// ScriptData can be re-used once complete
Cancel: function()
    {
    this.sd.Cancel();
    this.tm.Active(false);
    }
}; // NS.PostData

}); // startpad.data
