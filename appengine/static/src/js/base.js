namespace.lookup('org.startpad.base').defineOnce(function(ns) {
    var util = namespace.util;

ns.extend({
extendMissing: function(oDest, var_args)
    {
    if (oDest == undefined)
        oDest = {};

    for (var i = 1; i < arguments.length; i++)
        {
        var oSource = arguments[i];
        for (var prop in oSource)
            {
            if (oSource.hasOwnProperty(prop) && oDest[prop] == undefined)
                oDest[prop] = oSource[prop];
            }
        }

    return oDest;
    },

/* Javascript Enumeration - build an object whose properties are mapped to
 successive integers Also allow setting specific values by passing integers
 instead of strings. e.g. new ns.Enum("a", "b", "c", 5, "d") -> {a:0, b:1, c:2,
 d:5} */
Enum: function(args)
    {
    var j = 0;
    for (var i = 0; i < arguments.length; i++)
        {
        if (typeof arguments[i] == "string")
            this[arguments[i]] = j++;
        else
            j = arguments[i];
        }
    },

/* Return new object with just the listed properties "projected" into the new
   object */
project: function(obj, asProps)
    {
    var objT = {};

    for (var i = 0; i < asProps.length; i++)
        objT[asProps[i]] = obj[asProps[i]];

    return objT;
    },

/* Sort elements and remove duplicates from array (modified in place) */
uniqueArray: function(a)
    {
    if (!a)
        return;

    a.sort();
    for (var i = 1; i < a.length; i++)
        {
        if (a[i-1] == a[i])
            a.splice(i, 1);
        }
    },

map: function(a, fn)
    {
    var aRes = [];
    for (var i = 0; i < a.length; i++)
        aRes.push(fn(a[i]));
    return aRes;
    },

filter: function(a, fn)
    {
    var aRes = [];
    for (var i = 0; i < a.length; i++)
        {
        if (fn(a[i]))
            aRes.push(a[i]);
        }
    return aRes;
    },

reduce: function(a, fn)
    {
    if (a.length < 2)
        return a[0];

    var res = a[0];
    for (var i = 1; i < a.length-1; i++)
        res = fn(res, a[i]);

    return res;
    }
});

//--------------------------------------------------------------------------
// Fast string concatenation buffer
//--------------------------------------------------------------------------
ns.StBuf = function()
{
    this.rgst = [];
    this.append.apply(this, arguments);
};

util.extendObject(ns.StBuf.prototype, {
append: function() {
    for (var ist = 0; ist < arguments.length; ist++) {
        this.rgst.push(arguments[ist].toString());
    }
    return this;
},

clear: function () {
    this.rgst = [];
},

toString: function() {
    return this.rgst.join("");
}
}); // ns.StBuf

//--------------------------------------------------------------------------
// Some extensions to built-in JavaScript objects (sorry!)
//--------------------------------------------------------------------------

// Wrap a method call in a function - like protoype.bind
Function.prototype.fnMethod = function(obj)
{
    var _fn = this;
    return function () { return _fn.apply(obj, arguments); };
};

// Append additional arguments to a function
Function.prototype.fnArgs = function()
{
    var _fn = this;
    var _args = util.copyArray(arguments);

    return function () {
        var args = util.copyArray(arguments).concat(_args);
        return _fn.apply(this, args);
    };
};

}); // startpad.base
