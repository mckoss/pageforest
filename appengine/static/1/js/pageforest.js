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
            rgPairs[i] = base.strip(rgPairs[i]);
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

}); // org.startpad.cookies
/* Begin file: registration.js */
namespace.lookup('com.pageforest.registration').define(function(ns) {
    var util = namespace.util;

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
            if (fields.hasOwnProperty(name)) {
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
            tos: $("#id_tos").attr('checked') ? 'checked' : '',
            validate: true
        };
        var oneline = [data.username, data.email,
                       data.password, data.repeat];
        oneline = oneline.join('~');
        if (oneline == ns.previous) {
            return;
        }
        ns.previous = oneline;
        $.ajax({
            type: "POST",
            url: "/sign-up/",
            data: data,
            dataType: "json",
            success: validate_success,
            error: validate_error
        });
    }

    function document_ready() {
        ns.previous = '~~~';
        // Validate in the background
        setInterval(validate_if_changed, 3000);
        $("#id_tos").click(function() {
            $("#validate_tos").html('');
        });
    }

    // Request a new email verification for the signed in user.
    function resend() {
        console.log("resend");
        $.ajax({
            type: "POST",
            url: "/email-verify/",
            data: {resend: true},
            dataType: "json",
            success: validate_success,
            error: validate_error
        });
    }

    ns.extend({
        document_ready: document_ready,
        resend: resend
    });

}); // com.pageforest.registration
/* Begin file: sign-in-form.js */
namespace.lookup('com.pageforest.auth.sign-in-form').define(function(ns) {
    /*
      Handle logging a user into Pageforest and optionally also log
      them in to a Pageforest application.

      A logged in use will get a session key on www.pageforest.com.
      This script makes requests to appid.pageforest.com in order to
      get a cookie set on the application domain when the user wants
      to allow the application access to his store.
    */
    var cookies = namespace.lookup('org.startpad.cookies');

    ns.extend({
        // Check if user is already logged in.
        documentReady: function(username, appId) {
            ns.appId = appId;
            ns.appAuthURL = ns.getAppDomain(appId) + '/auth/';

            // Check for a (session) cookie with the application
            // session key. We clear it once used so it doesn't get
            // retransmitted. This could be used to either sign-in OR
            // sign-out of the application.
            var sessionName = appId + "-sessionkey";
            var appSession = cookies.getCookies()[sessionName];
            console.log("appSession: ", appSession);
            if (appSession != undefined) {
                cookies.setCookie(sessionName, 'expired', -1);
                ns.transferSession(appSession);
            }

            // Nothing to do until the user signs in - page will reload
            // on form post.
            if (!username) {
                return;
            }

            // Just logging in to pageforest - done.
            if (!appId) {
                ns.closeForm();
                return;
            }


            // Check (once) if we're also currently logged in @ appId
            // without having to sign-in again.
            // REVIEW: Isn't this insecure?
            ns.getString(ns.appAuthURL + "username/", function(username) {
                // We're already logged in!
                if (typeof(username) == 'string') {
                    ns.closeForm();
                    return;
                }
            });
        },

        transferSession: function(sessionKey) {
            // Send a valid appId sessionKey to the app domain
            // to get it installed on a cookie.
            ns.getString(ns.appAuthURL + "set-session/" + sessionKey, function (s) {
                if (typeof(s) != 'string') {
                    return;
                }
                // Close the window if this was used to sign in to the app.
                if (sessionKey)
                    ns.closeForm();
            });
        },

        // www.pageforest.com -> app.pageforest.com
        // pageforest.com -> app.pageforest.com
        getAppDomain: function(appId) {
            var parts = window.location.host.split('.');
            if (parts[0] == 'www')
                parts[0] = appId;
            else
                parts.splice(0, 0, appId);
            return parts.join('.');
        },

        // Use JSONP to read the username from the cross-site application.
        getString: function(url, fn) {
            url = "http://" + url;
            $.ajax({
                type: "GET",
                url: url,
                dataType: "jsonp",
                success: fn,
                error: function() {
                    fn({status:500});
                }
            });
        },

        // Display success, and close window in 5 seconds.
        closeForm: function() {
            function closeFinal() {
                // Close the window if we were opened by a cross-site script
                window.close();
            }
            if (ns.appId)
                $(".have_app").show();
            $(".want_app").hide();
            setTimeout(closeFinal, 2000);
        }

    }); // ns.extend

}); // com.pageforest.sign-in-form
