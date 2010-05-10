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
                     console.info("Namespace '" + nsCur._sPath +
                                  "' defined.");
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
/* Begin file: misc.js */
global_namespace.define("com.pageforest.misc", function(ns) {

    ns.strip = function(s) {
        return (s || "").replace(/^\s+|\s+$/g, "");
    };

});
/* Begin file: random.js */
global_namespace.define("com.pageforest.random", function(ns) {

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
global_namespace.define('com.pageforest.cookies', function(ns) {
    /*
    Client-side cookie reader and writing helper.

    Cookies can be quoted with "..." if they have spaces or other
    special characters. Internal quotes may be escaped with a \
    character These routines use encodeURIComponent to safely encode
    and decode all special characters.
    */
    var misc = ns.lookup('com.pageforest.misc');

ns.extend(ns, {
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
