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
