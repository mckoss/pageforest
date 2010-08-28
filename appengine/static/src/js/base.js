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

    // Copy any values that have changed from newest to last,
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
                if (last[prop] != value) {
                    last[prop] = value;
                    dest[prop] = value;
                    f = true;
                }
            }
        }
        return f;
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

    // Perform a deep comparison to check if two objects are equal.
    // Inspired by Underscore.js 1.1.0 - but improved.
    function isEqual(a, b) {
        if (a === b) {
            return true;
        }
        if (typeof a != typeof b) {
            return false;
        }
        if (a == b) {
            return true;
        }
        if (typeof a != 'object') {
            return false;
        }

        // TODO: Should a.constructor == b.constructor to be equal?
        // How about a.prototype === b.prototype?

        if (a instanceof Date) {
            return a.getTime() == b.getTime();
        }

        var i;

        // Compare two arrays.  Note that we treat as equal
        // a[i] == undefined - no matter if the element
        // would show up in for-in loop.  Note that
        // two arrays can be equal even if they are NOT
        // the same length (only differ by trailing undefineds).
        // Note we treat arguments as if they were arrays.
        if (a instanceof Array || isArguments(a)) {
            if (!(b instanceof Array || isArguments(b))) {
                return false;
            }

            var len = a.length;
            if (b.length != len) {
                // If the last element of the longer array is
                // not undefined, then the array's can't be equal.
                len = Math.max(len, b.length);
                if (a[len] != undefined && b[len] != undefined) {
                    return false;
                }
            }

            // Do a full array scan
            for (i = 0; i < len; i++) {
                if (!isEqual(a[i], b[i])) {
                    return false;
                }
            }
            return true;
        }

        var aKeys = keys(a);
        var bKeys = keys(b);
        if (aKeys.length != bKeys.length) {
            return false;
        }

        // Note that the keys may be in different order.  But if
        // we confirm that all of A's keys are equal it B's, we
        // don't have to check the converse.
        for (i = 0; i < aKeys.length; i++) {
            var prop = aKeys[i];
            if (!b.hasOwnProperty(prop) ||
                !isEqual(a[prop], b[prop])) {
                return false;
            }
        }
        return true;
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

    function valueInArray(value, a) {
        a = ensureArray(a);
        for (var i = 0; i < a.length; i++) {
            if (value == a[i]) {
                return true;
            }
        }
        return false;
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
        'valueInArray': valueInArray,
        'map': map,
        'filter': filter,
        'reduce': reduce,
        'keys': keys,
        'forEach': forEach,
        'ensureArray': ensureArray,
        'isEqual': isEqual
    });

}); // startpad.base
