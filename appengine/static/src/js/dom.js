/*globals jQuery */

//--------------------------------------------------------------------------
// DOM Functions
// Points (pt) are [x,y]
// Rectangles (rc) are [xTop, yLeft, xRight, yBottom]
//--------------------------------------------------------------------------
namespace.lookup('org.startpad.dom').define(function(ns) {
    var util = namespace.util;
    var vector = namespace.lookup('org.startpad.vector');
    var base = namespace.lookup('org.startpad.base');
    var ix = 0;
    var iy = 1;
    var ix2 = 2;
    var iy2 = 3;

    // Get absolute position on the page for the upper left of the element.
    function getPos(elt) {
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
    function getSize(elt) {
        return [elt.offsetWidth, elt.offsetHeight];
    }

    // Return absolute bounding rectangle for a DOM element:
    // [x, y, x + dx, y + dy]
    function getRect(elt) {
        // TODO: Should I use getClientRects or getBoundingClientRect?
        var rc = getPos(elt);
        var ptSize = getSize(elt);
        rc.push(rc[ix] + ptSize[ix], rc[iy] + ptSize[iy]);
        return rc;
    }

    // Relative rectangle within containing element
    function getOffsetRect(elt) {
        var rc = [elt.offsetLeft, elt.offsetTop];
        var ptSize = getSize(elt);
        rc.push(rc[ix] + ptSize[ix], rc[iy] + ptSize[iy]);
        return rc;
    }

    function getMouse(evt) {
        var x = document.documentElement.scrollLeft || document.body.scrollLeft;
        var y = document.documentElement.scrollTop || document.body.scrollTop;
        return [x + evt.clientX, y + evt.clientY];
    }

    function getWindowRect() {
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

    function setPos(elt, pt) {
        elt.style.left = pt[0] + 'px';
        elt.style.top = pt[1] + 'px';
    }

    function setSize(elt, pt) {
        // Setting the width of an element INSIDE the padding
        elt.style.width = pt[0] + 'px';
        elt.style.height = pt[1] + 'px';
    }

    function setRect(elt, rc) {
        setPos(elt, vector.ul(rc));
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

        var rcElt = getRect(elt);
        var rcWin = getWindowRect();

        if (vector.PtInRect(vector.UL(rcElt), rcWin) ||
            vector.PtInRect(vector.LR(rcElt), rcWin)) {
            elt.focus();
        }
    }

    function scrollToBottom(elt) {
        elt.scrollTop = elt.scrollHeight;
    }

    // Position a slide-out div with optional animation.
    function slide(div, pt, animation, fnCallback) {
        if (div.style.display != 'block') {
            div.style.display = 'block';
        }

        var rcPanel = getRect(div);
        var panelSize = getSize(div);
        var reg = animation == 'show' ? 'lr' : 'ur';
        rcPanel = vector.alignRect(rcPanel, reg, pt);

        // Starting position
        setPos(div, rcPanel);

        // Slide down or up based on animation

        if (animation == 'show') {
            jQuery(div).animate({
                top: '+=' + panelSize[1]
            }, fnCallback);
            return;
        }

        if (animation == 'hide') {
            jQuery(div).animate({
                top: '-=' + panelSize[1]
            }, function() {
                jQuery(this).hide();
                if (fnCallback) {
                    fnCallback();
                }
            });
        }
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
            if (mpValues[aNames[i]] != undefined) {
                mpFields[aNames[i]].value = mpValues[aNames[i]];
            }
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

       Accepts simple (single) selectors in one of three formats:

       #id
       .class
       tag
    */
    function $(sSelector) {
        var ch = sSelector.substr(0, 1);
        if (ch == '.' || ch == '#') {
            sSelector = sSelector.substr(1);
        }

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

        return ns.GetElementsByTagClassName(document, "*", sClassName);
    }

    /*
      GetElementsByTagClassName

      Written by Jonathan Snook, http://www.snook.ca/jonathan
      Add-ons by Robert Nyman, http://www.robertnyman.com
    */

    function getElementsByTagClassName(oElm, strTagName, strClassName) {
        var arrElements = (strTagName == "*" && oElm.all) ? oElm.all :
            oElm.getElementsByTagName(strTagName);
        var arrReturnElements = [];
        strClassName = strClassName.replace(/\-/g, "\\-");
        var oRegExp = new RegExp("(^|\\s)" + strClassName + "(\\s|$)");
        var oElement;
        for (var i = 0; i < arrElements.length; i++) {
            oElement = arrElements[i];
            if (oRegExp.test(oElement.className)) {
                arrReturnElements.push(oElement);
            }
        }
        return (arrReturnElements);
    }

    function getText(elt) {
        // Try FF then IE standard way of getting element text
        return base.strip(elt.textContent || elt.innerText);
    }

    function setText(elt, st) {
        if (elt.textContent != undefined) {
            elt.textContent = st;
        } else {
            elt.innerText = st;
        }
    }

    /* Modify original event object to enable the DOM Level 2 Standard
       Event model (make IE look like a Standards based event)
    */
    function wrapEvent(evt)
    {
        evt = evt || window.evt || {};

        if (!evt.preventDefault) {
            evt.preventDefault = function() {
                this.returnValue = false;
            };
        }

        if (!evt.stopPropagation) {
            evt.stopPropagation = function() {
                this.cancelBubble = true;
            };
        }

        if (!evt.target) {
            evt.target = evt.srcElement || document;
        }

        if (evt.pageX == null && evt.clientX != null) {
            var doc = document.documentElement;
            var body = document.body;
            evt.pageX = evt.clientX +
                (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
                (doc.clientLeft || 0);
            evt.pageY = evt.clientY +
                (doc && doc.scrollTop || body && body.scrollTop || 0) -
                (doc.clientTop || 0);
        }
        return evt;
    }

    var handlers = [];

    function bind(elt, event, fnCallback, capture) {
        if (!capture) {
            capture = false;
        }

        var fnWrap = function() {
            var args = util.copyArray(arguments);
            args[0] = wrapEvent(args[0]);
            return fnCallback.apply(elt, arguments);
        };

        if (elt.addEventListener) {
            elt.addEventListener(event, fnWrap, capture);
        } else if (elt.attachEvent) {
            elt.attachEvent('on' + event, fnWrap);
        } else {
            elt['on' + event] = fnWrap;
        }

        handlers.push({
            'elt': elt,
            'event': event,
            'capture': capture,
            'fn': fnWrap
        });

        return handlers.length - 1;
    }

    function unbind(i) {
        var handler = handlers[i];
        if (handler == undefined) {
            return;
        }
        handlers[i] = undefined;

        var elt = handler.elt;
        if (elt.removeEventListener) {
            elt.removeEventListener(handler.event, handler.fn, handler.capture);
        }
        else if (elt.attachEvent) {
            elt.detachEvent('on' + handler.event, handler.fn);
        }
        else {
            elt['on' + handler.event] = undefined;
        }
    }

    ns.extend({
        'getPos': getPos,
        'getSize': getSize,
        'getRect': getRect,
        'getOffsetRect': getOffsetRect,
        'getMouse': getMouse,
        'getWindowRect': getWindowRect,
        'setPos': setPos,
        'setSize': setSize,
        'setRect': setRect,
        'removeChildren': removeChildren,
        'ancestors': ancestors,
        'commonAncestorHeight': commonAncestorHeight,
        'setFocusIfVisible': setFocusIfVisible,
        'scrollToBottom': scrollToBottom,
        'bindIDs': bindIDs,
        'initValues': initValues,
        'readValues': readValues,
        '$': $,
        'select': $,
        'getElementsByClassName': getElementsByClassName,
        'getElementsByTagClassName': getElementsByTagClassName,
        'getText': getText,
        'setText': setText,
        'slide': slide,
        'bind': bind,
        'unbind': unbind
    });

}); // startpad.dom
