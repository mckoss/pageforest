// --------------------------------------------------------------------------
// Vector Functions
// --------------------------------------------------------------------------
global_namespace.define('org.startpad.vector', function(ns) {

ns.extend(ns, {
    x:0, y:1,
    x2:2, y2:3,

subFrom: function(v1, v2)
    {
    for (var i = 0; i < v1.length; i++)
        {
        v1[i] = v1[i] - v2[i % v2.length];
        }
    return v1;
    },

sub: function(v1, v2)
    {

    var vDiff = ns.copy(v1);
    return ns.subFrom(vDiff, v2);
    },

// In-place vector addition
// If smaller arrays are added to larger ones, they wrap around
// so that points can be added to rects, for example.
addTo: function(vSum)
    {
    for (var iarg = 1; iarg < arguments.length; iarg++)
        {
        var v = arguments[iarg];
        for (var i = 0; i < vSum.length; i++)
            {
            vSum[i] += v[i % v.length];
            }
        }
    return vSum;
    },

// Add corresponding elements of all arguments
add: function()
    {
    var vSum = ns.copy(arguments[0]);
    var args = ns.copy(arguments);
    args[0] = vSum;
    return ns.addTo.apply(undefined, args);
    },

// Return new vector with element-wise max
// All arguments must be same dimensioned array
// TODO: Allow mixing scalars - share code with mult - iterator/callback pattern
max: function()
    {
    var vMax = ns.copy(arguments[0]);
    for (var iarg = 1; iarg < arguments.length; iarg++)
        {
        var v = arguments[iarg];
        for (var i = 0; i < vMax.length; i++)
            {
            if (v[i] > vMax[i])
                {
                vMax[i] = v[i];
                }
            }
        }
    return vMax;
    },

// Multiply corresponding elements of all arguments (including scalars)
// All vectors must be the same dimension (length).
mult: function()
    {
    var vProd = 1;
    var i;

    for (var iarg = 0; iarg < arguments.length; iarg++)
        {
        var v = arguments[iarg];
        if (typeof v === "number")
            {
            // mult(scalar, scalar)
            if (typeof vProd === "number")
                {
                vProd *= v;
                }
            // mult(vector, scalar)
            else
                {
                for (i = 0; i < vProd.length; i++)
                    {
                    vProd[i] *= v;
                    }
                }
            }
        else
            {
            // mult(scalar, vector)
            if (typeof vProd === "number")
                {
                var vT = vProd;
                vProd = ns.copy(v);
                for (i = 0; i < vProd.length; i++)
                    {
                    vProd[i] *= vT;
                    }
                }
            // mult(vector, vector)
            else
                {
                if (v.length !== vProd.length)
                    {
                    throw new Error("Mismatched Vector Size");
                    }
                for (i = 0; i < vProd.length; i++)
                    {
                    vProd[i] *= v[i];
                    }
                }
            }
        }
    return vProd;
    },

floor: function(v)
    {
    var vFloor = [];
    for (var i = 0; i < v.length; i++)
        {
        vFloor[i] = Math.floor(v[i]);
        }
    return vFloor;
    },

dotProduct: function()
    {
    var v = ns.mult.apply(undefined, arguments);
    var s = 0;
    for (var i = 0; i < v.length; i++)
        {
        s += v[i];
        }
    return s;
    },

// Append all arrays into a new array (append(v) is same as copy(v)
append: function()
    {
    var v1 = [].concat.apply([], arguments);
    return v1;
    },

// Do a (shallow) comparison of two arrays
equal: function(v1, v2)
    {
    if (typeof v1 != typeof v2)
        return false;
    if (typeof v1 == 'undefined')
        return true;
    for (var i = 0; i < v1.length; i++)
        {
        if (v1[i] !== v2[i])
            {
            return false;
            }
        }
    return true;
    },

// Routines for dealing with Points [x, y] and Rects [left, top, bottom, right]

ul: function(rc)
    {
    return rc.slice(0, 2);
    },

lr: function(rc)
    {
    return rc.slice(2, 4);
    },

size: function(rc)
    {
    return ns.sub(ns.lr(rc), ns.ul(rc));
    },

numInRange: function(num, numMin, numMax)
    {
    return num >= numMin && num <= numMax;
    },

clipToRange: function(num, numMin, numMax)
    {
    if (num < numMin)
        return numMin;
    if (num > numMax)
        return numMax;
    return num;
    },

ptInRect: function(pt, rc)
    {
    return ns.numInRange(pt[ns.x], rc[ns.x], rc[ns.x2]) &&
        ns.numInRange(pt[ns.y], rc[ns.y], rc[ns.y2]);
    },

ptClipToRect: function(pt, rc)
    {
    return [ns.clipToRange(pt[ns.x], rc[ns.x], rc[ns.x2]),
        ns.clipToRange(pt[ns.y], rc[ns.y], rc[ns.y2])];
    },

rcClipToRect: function(rc, rcClip)
    {
    return ns.append(ns.ptClipToRect(ns.ul(rc), rcClip),
                     ns.ptClipToRect(ns.lr(rc), rcClip));
    },

rcExpand: function(rc, ptSize)
    {
    return ns.append(ns.sub(ns.ul(rc), ptSize),
                     ns.add(ns.lr(rc), ptSize));
    },

keepInRect: function(rcIn, rcBound)
    {
    // First, make sure the rectangle is not bigger than either bound dimension
    var ptFixSize = ns.max([0,0],ns.sub(ns.size(rcIn), ns.size(rcBound)));
    rcIn[ns.x2] -= ptFixSize[ns.x];
    rcIn[ns.y2] -= ptFixSize[ns.y];

    // Now move the rectangle to be totally within the bounds
    var dx = 0; dy = 0;
    dx = Math.max(0, rcBound[ns.x] - rcIn[ns.x]);
    dy = Math.max(0, rcBound[ns.y] - rcIn[ns.y]);
    if (dx == 0)
        dx = Math.min(0, rcBound[ns.x2] - rcIn[ns.x2]);
    if (dy == 0)
        dy = Math.min(0, rcBound[ns.y2] - rcIn[ns.y2]);
    ns.addTo(rcIn, [dx, dy]);
    },

// Return pt (1-scale) * ul + scale * lr
ptCenter: function(rc, scale)
    {
    if (scale === undefined)
        {
        scale = 0.5;
        }
    if (typeof scale === "number")
        {
        scale = [scale, scale];
        }
    var pt = ns.mult(scale, ns.lr(rc));
    scale = ns.sub([1,1], scale);
    ns.addTo(pt, ns.mult(scale, ns.ul(rc)));
    return pt;
    },

// ptRegistration - return one of 9 registration points of a rectangle
// 0 1 2
// 3 4 5
// 6 7 8
ptRegistration: function(rc, iReg)
    {
    var xScale = (iReg % 3) * 0.5;
    var yScale = Math.floor(iReg/3) * 0.5;
    return ns.ptCenter(rc, [xScale, yScale]);
    },

iRegClosest: function(pt, rc)
    {
    var aPoints = [];
    for (var i = 0; i < 9; i++)
        {
        aPoints.push(ns.ptRegistration(rc, i));
        }
    return ns.IPtClosest(pt, aPoints)[0];
    },

// rectDeltaReg - Move or resize the rectangle based on the registration
// point to be modified.  Center (4) moves the whole rect.
// Others resize one or more edges of the rectangle
rectDeltaReg: function(rc, dpt, iReg, ptSizeMin, rcBounds)
    {
    if (iReg == 4)
        {
        var rcT = ns.add(rc, dpt);
        if (rcBounds)
            ns.keepInRect(rcT, rcBounds);
        return rcT;
        }

    var iX = iReg % 3;
    if (iX == 1)
        iX = undefined;

    var iY = Math.floor(iReg/3);
    if (iY == 1)
        iY = undefined;

    function ApplyDelta(rc, dpt)
        {
        var rcDelta = [0,0,0,0];
        if (iX != undefined)
            rcDelta[iX] = dpt[0];
        if (iY != undefined)
            rcDelta[iY+1] = dpt[1];
        return ns.add(rc, rcDelta);
        }

    var rcT = ApplyDelta(rc, dpt);

    // Ensure the rectangle is not less than the minimum size
    if (!ptSizeMin)
        ptSizeMin = [0,0];
    var ptSize = ns.size(rcT);
    var ptFixSize = ns.max([0,0],ns.sub(ptSizeMin, ptSize));
    if (iX == 0)
        ptFixSize[0] *= -1;
    if (iY == 0)
        ptFixSize[1] *= -1;
    rcT = ApplyDelta(rcT, ptFixSize);

    // Ensure rectangle is not outside the bounding box
    if (rcBounds)
        ns.keepInRect(rcT, rcBounds);
    return rcT;
    },

// Find the closest point to the given point
// (multiple) arguments can be points, or arrays of points
// Returns [i, pt] result
iPtClosest: function(pt)
    {
    var d2Min = undefined;
    var ptClosest = undefined;
    var iClosest = undefined;

    var iPt = 0;
    for (var iarg = 1; iarg < arguments.length; iarg++)
        {
        var v = arguments[iarg];
        // Looks like a single point
        if (typeof v[0] == "number")
            {
            var d2 = ns.Distance2(pt, v);
            if (d2Min == undefined || d2 < d2Min)
                {
                d2Min = d2;
                ptClosest = v;
                iClosest = iPt;
                }
            iPt++;
            }
        // Looks like an array of points
        else
            {
            for (var i = 0; i < v.length; i++)
                {
                vT = v[i];
                var d2 = ns.Distance2(pt, vT);
                if (d2Min == undefined || d2 < d2Min)
                    {
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
distance2: function (v1, v2)
    {
    var d2 = 0;
    for (var i = 0; i < v1.length; i++)
        d2 += Math.pow((v2[i]-v1[i]), 2);
    return d2;
    },

// Return the bounding box of the collection of pt's and rect's
boundingBox: function()
    {
    var vPoints = ns.append.apply(undefined, arguments);
    if (vPoints.length % 2 !== 0)
        {
        throw Error("Invalid arguments to boundingBox");
        }

    var ptMin = vPoints.slice(0,2),
        ptMax = vPoints.slice(0,2);

    for (var ipt = 2; ipt < vPoints.length; ipt += 2)
        {
        var pt = vPoints.slice(ipt, ipt+2);
        if (pt[0] < ptMin[0])
            {
            ptMin[0] = pt[0];
            }
        if (pt[1] < ptMin[1])
            {
            ptMin[1] = pt[1];
            }
        if (pt[0] > ptMax[0])
            {
            ptMax[0] = pt[0];
            }
        if (pt[1] > ptMax[1])
            {
            ptMax[1] = pt[1];
            }
        }

    return [ptMin[0], ptMin[1], ptMax[0], ptMax[1]];
    },

// Return json string for numeric array
json: function(v)
    {
    var sRect = "[";
    var chSep = "";
    for (i = 0; i < v.length; i++)
        {
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