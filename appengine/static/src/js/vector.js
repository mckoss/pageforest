// --------------------------------------------------------------------------
// Vector Functions
// --------------------------------------------------------------------------
namespace.lookup('org.startpad.vector').defineOnce(function(ns) {
    var util = namespace.util;

    var x = 0;
    var y = 1;
    var x2 = 2;
    var y2 = 3;
    var regNums = {
        'ul': 0,
        'top': 1,
        'ur': 2,
        'left': 3,
        'center': 4,
        'right': 5,
        'll': 6,
        'bottom': 7,
        'lr': 8
    };

    // Subtract second vector from first (in place).
    function subFrom(v1, v2) {
        for (var i = 0; i < v1.length; i++) {
            v1[i] = v1[i] - v2[i % v2.length];
        }
        return v1;
    }

    // Append all arrays into a new array (append(v) is same as copy(v)
    function copy() {
        var v1 = Array.prototype.concat.apply([], arguments);
        return v1;
    }

    function sub(v1, v2) {
        var vDiff = copy(v1);
        return subFrom(vDiff, v2);
    }

    // In-place vector addition
    // If smaller arrays are added to larger ones, they wrap around
    // so that points can be added to rects, for example.
    function addTo(vSum) {
        for (var iarg = 1; iarg < arguments.length; iarg++) {
            var v = arguments[iarg];
            for (var i = 0; i < vSum.length; i++) {
                vSum[i] += v[i % v.length];
            }
        }
        return vSum;
    }

    // Add corresponding elements of all arguments
    function add() {
        var vSum = copy(arguments[0]);
        var args = util.copyArray(arguments);
        args[0] = vSum;
        return addTo.apply(undefined, args);
    }

    // Return new vector with element-wise max All arguments must
    // be same dimensioned array.

    // TODO: Allow mixing scalars - share code with mult -
    // iterator/callback pattern
    function max() {
        var vMax = copy(arguments[0]);
        for (var iarg = 1; iarg < arguments.length; iarg++) {
            var v = arguments[iarg];
            for (var i = 0; i < vMax.length; i++) {
                if (v[i] > vMax[i]) {
                    vMax[i] = v[i];
                }
            }
        }
        return vMax;
    }

    // Multiply corresponding elements of all arguments (including scalars)
    // All vectors must be the same dimension (length).
    function mult() {
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
                    vProd = copy(v);
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
    }

    function floor(v) {
        var vFloor = [];
        for (var i = 0; i < v.length; i++) {
            vFloor[i] = Math.floor(v[i]);
        }
        return vFloor;
    }

    function dotProduct() {
        var v = mult.apply(undefined, arguments);
        var s = 0;
        for (var i = 0; i < v.length; i++) {
            s += v[i];
        }
        return s;
    }

    // Do a (deep) comparison of two arrays. Any embeded objects
    // are assumed to also be arrays of scalars or other arrays.
    function equal(v1, v2) {
        if (v1.length != v2.length) {
            return false;
        }
        for (var i = 0; i < v1.length; i++) {
            if (typeof v1[i] != typeof v2[i]) {
                return false;
            }
            if (typeof v1[i] == "object") {
                if (!equal(v1[i], v2[i])) {
                    return false;
                }
            } else {
                if (v1[i] != v2[i]) {
                    return false;
                }
            }
        }
        return true;
    }

    // Routines for dealing with Points [x, y] and Rects [left,
    // top, bottom, right]
    function ul(rc) {
        return rc.slice(0, 2);
    }

    function lr(rc) {
        return rc.slice(2, 4);
    }

    function size(rc) {
        return sub(lr(rc), ul(rc));
    }

    function area(rc) {
        var dv = size(rc);
        return dv[0] * dv[1];
    }

    function numInRange(num, numMin, numMax) {
        return num >= numMin && num <= numMax;
    }

    function clipToRange(num, numMin, numMax) {
        if (num < numMin) {
            return numMin;
        }
        if (num > numMax) {
            return numMax;
        }
        return num;
    }

    function ptInRect(pt, rc) {
        return numInRange(pt[x], rc[x], rc[x2]) &&
            numInRange(pt[y], rc[y], rc[y2]);
    }

    function ptClipToRect(pt, rc) {
        return [clipToRange(pt[x], rc[x], rc[x2]),
                clipToRange(pt[y], rc[y], rc[y2])];
    }

    function rcClipToRect(rc, rcClip) {
        return copy(ptClipToRect(ul(rc), rcClip),
                    ptClipToRect(lr(rc), rcClip));
    }

    // Return pt (1-scale) * ul + scale * lr
    function ptCenter(rc, scale) {
        if (scale === undefined) {
            scale = 0.5;
        }
        if (typeof scale === "number") {
            scale = [scale, scale];
        }
        var pt = mult(scale, lr(rc));
        scale = sub([1, 1], scale);
        addTo(pt, mult(scale, ul(rc)));
        return pt;
    }

    function rcExpand(rc, ptSize) {
        var rcExp = copy(sub(ul(rc), ptSize),
                         add(lr(rc), ptSize));
        // If array bounds are inverted - make a zero-dimension
        // at the midpoint between the original coordinates.
        var ptC = ptCenter(rc);
        if (rcExp[x] > rcExp[x2]) {
            rcExp[x] = rcExp[x2] = ptC[x];
        }
        if (rcExp[y] > rcExp[y2]) {
            rcExp[y] = rcExp[y2] = ptC[y];
        }
        return rcExp;
    }

    function keepInRect(rcIn, rcBound) {
        // First, make sure the rectangle is not bigger than
        // either bound dimension
        var ptFixSize = max([0, 0], sub(size(rcIn),
                                        size(rcBound)));
        rcIn[x2] -= ptFixSize[x];
        rcIn[y2] -= ptFixSize[y];
        // Now move the rectangle to be totally within the bounds
        var dx = 0;
        var dy = 0;
        dx = Math.max(0, rcBound[x] - rcIn[x]);
        dy = Math.max(0, rcBound[y] - rcIn[y]);
        if (dx == 0) {
            dx = Math.min(0, rcBound[x2] - rcIn[x2]);
        }
        if (dy == 0) {
            dy = Math.min(0, rcBound[y2] - rcIn[y2]);
        }
        addTo(rcIn, [dx, dy]);
    }

    // ptRegistration - return one of 9 registration points of a rectangle
    // 0 1 2
    // 3 4 5
    // 6 7 8
    function ptRegistration(rc, reg) {
        if (typeof reg == 'string') {
            reg = regNums[reg];
        }
        var xScale = (reg % 3) * 0.5;
        var yScale = Math.floor(reg / 3) * 0.5;
        return ptCenter(rc, [xScale, yScale]);
    }

    function magnitude2(v1) {
        var d2 = 0;
        for (var i = 0; i < v1.length; i++) {
            d2 += Math.pow(v1[i], 2);
        }
        return d2;
    }

    // Return square of distance between to "points" (N-dimensional)
    function distance2(v1, v2) {
        var dv = sub(v2, v1);
        return magnitude2(dv);
    }

    function unitVector(v1) {
        var m2 = magnitude2(v1);
        return mult(v1, 1 / Math.sqrt(m2));
    }

    // Find the closest point to the given point
    // (multiple) arguments can be points, or arrays of points
    // Returns [i, pt] result
    function iPtClosest(pt) {
        var d2Min;
        var ptClosest;
        var iClosest;
        var d2;
        var iPt = 0;
        for (var iarg = 1; iarg < arguments.length; iarg++) {
            var v = arguments[iarg];
            // Looks like a single point
            if (typeof v[0] == "number") {
                d2 = distance2(pt, v);
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
                    d2 = distance2(pt, vT);
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
    }

    function iRegClosest(pt, rc) {
        var aPoints = [];
        for (var i = 0; i < 9; i++) {
            aPoints.push(ptRegistration(rc, i));
        }
        return iPtClosest(pt, aPoints)[0];
    }


    // Move a rectangle so that one of it's registration
    // points is located at a given point.
    function alignRect(rc, reg, ptTo) {
        var ptFrom = ptRegistration(rc, reg);
        return add(rc, sub(ptTo, ptFrom));
    }

    // Move or resize the rectangle based on the registration
    // point to be modified.  Center (4) moves the whole rect.
    // Others resize one or more edges of the rectangle
    function rcDeltaReg(rc, dpt, iReg, ptSizeMin, rcBounds) {
        var rcT;
        if (iReg == 4) {
            rcT = add(rc, dpt);
            if (rcBounds) {
                keepInRect(rcT, rcBounds);
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
            return add(rc, rcDelta);
        }
        rcT = applyDelta(rc, dpt);
        // Ensure the rectangle is not less than the minimum size
        if (!ptSizeMin) {
            ptSizeMin = [0, 0];
        }
        var ptSize = size(rcT);
        var ptFixSize = max([0, 0], sub(ptSizeMin, ptSize));
        if (iX == 0) {
            ptFixSize[0] *= -1;
        }
        if (iY == 0) {
            ptFixSize[1] *= -1;
        }
        rcT = applyDelta(rcT, ptFixSize);
        // Ensure rectangle is not outside the bounding box
        if (rcBounds) {
            keepInRect(rcT, rcBounds);
        }
        return rcT;
    }

    // Return the bounding box of the collection of pt's and rect's
    function boundingBox() {
        var vPoints = copy.apply(undefined, arguments);
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
    }

    ns.extend({
        'x': x,
        'y': y,
        'x2': x2,
        'y2': y2,
        'equal': equal,
        'sub': sub,
        'subFrom': subFrom,
        'add': add,
        'addTo': addTo,
        'max': max,
        'mult': mult,
        'distance2': distance2,
        'magnitude2': magnitude2,
        'unitVector': unitVector,
        'floor': floor,
        'dotProduct': dotProduct,
        'ul': ul,
        'lr': lr,
        'copy': copy,
        'append': copy,
        'size': size,
        'area': area,
        'numInRange': numInRange,
        'clipToRange': clipToRange,
        'ptInRect': ptInRect,
        'ptClipToRect': ptClipToRect,
        'rcClipToRect': rcClipToRect,
        'ptCenter': ptCenter,
        'boundingBox': boundingBox,
        'ptRegistration': ptRegistration,
        'rcExpand': rcExpand,
        'alignRect': alignRect,
        'keepInRect': keepInRect,
        'iRegClosest': iRegClosest,
        'rcDeltaReg': rcDeltaReg
    });
}); // startpad.vector
