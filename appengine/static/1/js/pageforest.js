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
            url: "/sign-up",
            data: data,
            dataType: "json",
            success: validate_success,
            error: validate_error
        });
    }

    ns.document_ready = function () {
        ns.previous = '~~~';
        // Validate in the background
        setInterval(validate_if_changed, 3000);
        $("#id_tos").click(function() {
            $("#validate_tos").html('');
        });
    };

}); // com.pageforest.registration
/* Begin file: sign-in-form.js */
global_namespace.define('com.pageforest.auth.sign-in-form', function(ns) {
    /*
      Handle logging a user into Pageforest and optionally also log
      them in to a Pageforest application.

      A logged in use will get a session key on www.pageforest.com.
      This script makes requests to appid.pageforest.com in order to
      get a cookie set on the application domain when the user wants
      to allow the application access to his store.

      TODO: Remove application session cookie on Sign-out.
    */
    var cookies = ns.lookup('org.startpad.cookies');

    ns.extend(ns, {
        // Check if user is already logged in.
        documentReady: function(username, appId) {
            ns.appId = appId;
            ns.appAuthURL = ns.getAppDomain(appId) + '/auth/';

            // Nothing to do until the user signs in - page will reload
            // on form post.
            if (!username)
                return;

            // Just logging in to pageforest - done.
            if (!appId) {
                ns.closeForm();
                return;
            }

            // Check for a (session) cookie with the application session
            // key.  We clear it once used so it doesn't get retransmitted.
            var sessionName = appId + "-sessionkey";
            var appSession = cookies.getCookies()[sessionName];
            if (appSession != undefined) {
                cookies.setCookie(sessionName, '', 0);
                ns.transferSession(appSession);
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
                alert(s);
                if (typeof(s) != 'string') {
                    return;
                }
                ns.closeForm();
            });
        },

        // www.pf.com -> app.pf.com
        // pf.com -> app.pf.com
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
            setTimeout(closeFinal, 5000);
        }

    }); // ns.extend

}); // com.pageforest.sign-in-form
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
    },

strip: function(s)
    {
    return (s || "").replace( /^\s+|\s+$/g, "");
    }

});

//--------------------------------------------------------------------------
// Some extensions to built-in JavaScript objects (sorry!)
//--------------------------------------------------------------------------

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
/* Begin file: cookies.js */
global_namespace.define('org.startpad.cookies', function(ns) {
    /*
    Client-side cookie reader and writing helper.

    Cookies can be quoted with "..." if they have spaces or other
    special characters. Internal quotes may be escaped with a \
    character These routines use encodeURIComponent to safely encode
    and decode all special characters.
    */
    var format = ns.lookup('org.startpad.format-util');

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
        rgPairs[i] = format.strip(rgPairs[i]);
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
