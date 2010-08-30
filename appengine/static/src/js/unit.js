// unit.js - Unit testing framework
// Copyright (c) 2007-2010, Mike Koss (mckoss@startpad.org)
//
// Usage:
// ts = new TestSuite("Suite Name");
// ts.DWOutputDiv();
// ts.addTest("Test Name", function(ut) { ... ut.assert() ... });
// ...
// ts.run(nests);
//
// UnitTest - Each unit test calls a function which in turn calls
// back assert's on the unit test object.

/*jslint evil:true */
/*globals load */

namespace.lookup('org.startpad.unit').defineOnce(function(ns) {
    var util = namespace.util;
    var timer = namespace.lookup('org.startpad.timer');
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');
    var loader = namespace.lookup('org.startpad.loader');

    function UnitTest(stName, fn) {
        this.stName = stName;
        this.fn = fn;
        this.rgres = [];
    }

    // Wrap all the exported functions in a namespace for the purpose
    // of counting calls to each function.
    function Coverage(namespaceName) {
        this.name = namespaceName;
        this.ns = namespace.lookup(namespaceName);
        this.funcs = {};
        this.called = {};
        this.methods = {};

        for (var name in this.ns) {
            if (this.ns.hasOwnProperty(name)) {
                if (typeof this.ns[name] != 'function' ||
                    // Don't wrap ourselves!
                    this.ns[name] === this.constructor) {
                    continue;
                }

                var func = this.ns[name];
                this.funcs[name] = func;
                this.ns[name] = this.wrapFunc(name, func);

                // In case func is a constructor, use it's prototype
                // object so we inherit all it's properties when
                // we create instances!
                this.ns[name].prototype = func.prototype;
                this.methods[name] = {};

                // For functions that are constructors, wrap all the
                // methods (function prototype functions).
                for (var method in func.prototype) {
                    if (typeof func.prototype[method] == 'function') {
                        var fnMethod = func.prototype[method];
                        this.methods[name][method] = fnMethod;
                        func.prototype[method] =
                            this.wrapFunc(name + ':' + method,
                                          fnMethod);
                    }
                }
            }
        }
    }

    util.extendObject(UnitTest, {
        states: {
            created: 0,
            running: 1,
            completed: 2
        }
    });

    UnitTest.methods({
        state: UnitTest.states.created,
        cErrors: 0,
        cErrorsExpected: 0,
        cAsserts: 0,
        fEnable: true,
        cAsync: 0,
        fThrows: false,
        cThrows: 0,
        msTimeout: 5000,
        stTrace: "",
        cBreakOn: 0,
        fStopFail: false,

        run: function(ts) {
            var fCaught = false;
            if (!this.fEnable) {
                return;
            }
            if (this.cAsync) {
                if (typeof setInterval == 'undefined') {
                    this.enable(false);
                    return;
                } else {
                    this.tm = new timer.Timer(this.msTimeout,
                        this.timeout.fnMethod(this)).active();
                }
            }
            this.state = UnitTest.states.running;
            try {
                this.fn(this);
            }
            catch (e) {
                fCaught = true;
                this.fStopFail = false; // Avoid recursive asserts
                this.e = e;
                this.async(0);
                this.assertException(this.e, this.stThrows, this.fThrows);
            }
            if (this.fThrows && !fCaught) {
                this.assert(false, "Missing expected Exception: " +
                            this.stThrows);
            }
            if (!this.cAsync) {
                this.state = UnitTest.states.completed;
            }
        },

        isComplete: function() {
            return !this.fEnable || this.state == UnitTest.states.completed;
        },

        assertThrown: function() {
            this.assertGT(this.cThrows, 0, "Expected exceptions not thrown.");
            this.cThrows = 0;
        },

        enable: function(f) {
            this.fEnable = f;
            return this;
        },

        require: function(toEval) {
            var type = eval('typeof ' + toEval);
            if (type == 'undefined') {
                this.enable(false);
            }
        },

        stopFail: function(f) {
            this.fStopFail = f;
            return this;
        },

        // Change expected number async events running - test is finishd at 0.
        // async(false) -> -1
        // async(true) -> +1
        // async(0) -> set cAsync to zero
        // async(c) -> +c

        // TODO: Could use Expected number of calls to assert to
        // terminate an async test instead of relying on the cAsync
        // count going to zero.
        async: function(dc, msTimeout) {
            if (dc == undefined || dc === true) {
                dc = 1;
            }
            if (dc === false) {
                dc = -1;
            }
            if (msTimeout) {
                // Don't call assert unless we have a failure - would
                // mess up user counts for numbers of asserts
                // expected.
                if (this.cAsync != 0 ||
                    this.state == UnitTest.states.running) {
                    this.assert(false,
                                "Async timeout only allowed at " +
                                "test initialization.");
                }
                this.msTimeout = msTimeout;
            }
            if (dc == 0) {
                this.cAsync = 0;
            }
            else {
                this.cAsync += dc;
            }
            if (this.cAsync < 0) {
                this.assert(false, "Test error: unbalanced calls to async");
                this.cAsync = 0;
            }
            // When cAsync goes to zero, the aynchronous test is complete
            if (this.cAsync == 0 && this.state == UnitTest.states.running) {
                this.state = UnitTest.states.completed;
            }
            this.checkValid();
            return this;
        },

        timeout: function() {
            if (this.cAsync > 0) {
                this.fStopFail = false;
                this.async(0);
                this.assert(false, "Async test timed out.");
            }
        },

        throwsException: function(stThrows) {
            this.fThrows = true;
            this.stThrows = stThrows;
            this.checkValid();
            return this;
        },

        expect: function(cErrors, cTests) {
            this.cErrorsExpected = cErrors;
            this.cTestsExpected = cTests;
            return this;
        },

        checkValid: function() {
            if (this.cAsync > 0 && this.fThrows) {
                this.assert(false, "Can't test async thrown exceptions.");
            }
        },

        reference: function(url) {
            this.urlRef = url;
            return this;
        },

        // All asserts bottleneck to this function
        // Eror line pattern "N. [Trace] Note (Note2)"
        assert: function(f, stNote, stNote2) {
            // TODO: is there a way to get line numbers out of the callers?
            // A backtrace (outside of unit.js) would be the best way to
            // designate the location of failing asserts.
            if (stNote == undefined) {
                stNote = "";
            }
            if (this.stTrace != '') {
                stNote = (this.cAsserts + 1) + ". [" + this.stTrace + "] " +
                    stNote;
            }
            else {
                stNote = (this.cAsserts + 1) + ". " + stNote;
            }
            if (stNote2 != undefined) {
                stNote += " (" + stNote2 + ")";
            }
            // Allow the user to set a breakpoint when we hit a particular
            // failing test
            if (!f && (this.cBreakOn == -1 ||
                       this.cBreakOn == this.cAsserts + 1)) {
                this.breakpoint(stNote);
            }
            var res = new ns.TestResult(f, this, stNote);
            this.rgres.push(res);
            if (!res.f) {
                this.cErrors++;
            }
            this.cAsserts++;
            // We don't throw an exception on stopFail if we already have
            // thrown one!
            if (this.fStopFail && this.cErrors > this.cErrorsExpected &&
                !this.e) {
                this.fStopFail = false;
                this.async(0);
                throw new Error("stopFail - test terminates on first " +
                                "(unexpected) failure.");
            }
        },

        trace: function(stTrace) {
            this.stTrace = stTrace;
        },

        // Set to -1 to trace/break on all errors.  Set to N to break on the Nth
        // failure only.
        breakOn: function(cBreakOn) {
            this.cBreakOn = cBreakOn;
        },

        // Set Firebug breakpoint in this function
        breakpoint: function(stNote) {
            console.log("unit.js breakpoint: [" + this.stName + "] " + stNote);
            // Set Firebug breakpoint on this line:
            var x = 1;
        },

        assertEval: function(stEval) {
            this.assert(eval(stEval), stEval);
        },

        // v1 is the quantity to be tested against the "known" quantity, v2.
        assertEq: function(v1, v2, stNote) {
            if (typeof v1 != typeof v2) {
                this.assert(false, "Comparing values of different type: " +
                            typeof v1 + ", " + typeof v2, stNote);
                return;
            }
            switch (typeof v1) {
            case "string":
                var pos = "";
                if (v1 != v2) {
                    for (var i = 0; i < v2.length; i++) {
                        if (v1[i] != v2[i]) {
                            pos += "@" + i + " x" +
                                v1.charCodeAt(i).toString(16) + " != x" +
                                v2.charCodeAt(i).toString(16) + ", ";
                            break;
                        }
                    }
                }
                this.assert(v1 == v2, "\"" + v1 + "\" == \"" + v2 +
                            "\" (" + pos + "len: " + v1.length + ", " +
                            v2.length + ")", stNote);
                break;
            case "object":
                if (v1 instanceof Array) {
                    this.assertDeepEq(v1, v2, stNote);
                    return;
                }

                // Make sure Dates match
                if (v1.constructor == Date) {
                    this.assertEq(v2.constructor, Date);
                    if (v2.constructor == Date) {
                        this.assertEq(v1.toString(), v2.toString(), stNote);
                    }
                    return;
                }

                this.assertContains(v1, v2);
                var cProp1 = this.propCount(v1);
                var cProp2 = this.propCount(v2);
                this.assert(cProp1 == cProp2,
                            "Objects have different property counts (" +
                            base.keys(v1).join(',') + " != " +
                            base.keys(v2).join(',') + ")",
                            stNote);
                break;

            default:
                this.assert(v1 == v2, v1 + " == " +
                            v2 + " (type: " + typeof v1 + ")", stNote);
                break;
            }
        },

        // Compare two arrays for equality (recursively)
        assertDeepEq: function(v1, v2, stNote) {
            if (!(v1 instanceof Array)) {
                this.assertEq(v1, v2, stNote);
                return;
            }
            this.assertType(v2, Array, stNote);
            this.assertEq(v1.length, v2.length, stNote);
            for (var i = 0; i < v1.length; i++) {
                this.assertDeepEq(v1[i], v2[i], stNote);
            }
            return true;
        },

        propCount: function(obj) {
            var cProp = 0;
            for (var prop in obj) {
                if (obj.hasOwnProperty(prop)) {
                    cProp++;
                }
            }
            return cProp;
        },

        assertType: function(v1, type, stNote) {
            if (type == "array") {
                type = Array;
            }
            // Check if object is an instance of type
            if (typeof type == "function") {
                this.assertEq(typeof v1, "object", stNote);
                this.assert(v1 instanceof type, stNote, "not a " + type);
                return;
            }
            this.assertEq(typeof v1, type, stNote);
        },

        assertTypes: function(obj, mTypes) {
            for (var prop in mTypes) {
                if (mTypes.hasOwnProperty(prop)) {
                    this.assertType(obj[prop], mTypes[prop],
                                    prop + " should be type " + mTypes[prop]);
                }
            }
        },

        // assert that objAll contains all the (top level) properties of objSome
        assertContains: function(objAll, objSome) {
            var prop;
            if (typeof objAll != "object" || typeof objSome != "object") {
                this.assert(false, "AssertContains expects objects: " +
                            typeof objAll + " ~ " + typeof objSome);
                return;
            }
            // For arrays, just confirm that the elements of the 2nd array
            // are included as members of the first
            if (objSome instanceof Array) {
                if (!(objAll instanceof Array)) {
                    this.assert(false, "assertContains unmatched Array: " +
                                objAll.constructor);
                    return;
                }
                var map1 = {};
                for (prop in objAll) {
                    if (objAll.hasOwnProperty(prop)) {
                        if (typeof(objAll[prop]) != 'object') {
                            map1[objAll[prop]] = true;
                        }
                    }
                }
                for (prop in objSome) {
                    if (objSome.hasOwnProperty(prop)) {
                        if (typeof(objSome[prop]) != 'object') {
                            this.assert(map1[objSome[prop]],
                                        "Missing array value: " +
                                        objSome[prop] + " (type: " +
                                        typeof(objSome[prop]) + ")");
                        }
                        else {
                            this.assert(false,
                                        "assertContains does " +
                                        "shallow compare only");
                        }
                    }
                }
                return;
            }
            for (prop in objSome) {
                if (objSome.hasOwnProperty(prop)) {
                    this.assertEq(objAll[prop], objSome[prop], "prop: " + prop);
                }
            }
        },

        assertIdent: function(v1, v2) {
            this.assert(v1 === v2, v1 + " === " + v2);
        },

        assertNEq: function(v1, v2) {
            this.assert(v1 != v2, v1 + " != " + v2);
        },

        assertGT: function(v1, v2) {
            this.assert(v1 > v2, v1 + " > " + v2);
        },

        assertLT: function(v1, v2) {
            this.assert(v1 < v2, v1 + " < " + v2);
        },

        assertFn: function(fn) {
            var stFn = fn.toString();
            stFn = stFn.substring(stFn.indexOf("{") + 1,
                                  stFn.lastIndexOf("}") - 1);
            this.assert(fn(), stFn);
        },

        // Useage: ut.assertThrows(<type>, function(ut) {...});
        assertThrows: function(stExpected, fn) {
            try {
                fn(this);
            }
            catch (e) {
                this.assertException(e, stExpected);
                return;
            }
            this.assert(false, "Missing expected Exception: " + stExpected);
        },

        // assert expected and caught exceptions
        // If stExpected != undefined, e.name or e.message must contain it
        assertException: function(e, stExpected, fExpected) {
            if (fExpected == undefined) {
                fExpected = true;
            }
            if (fExpected) {
                if (e.name) {
                    e.name = e.name.toLowerCase();
                }
                if (e.message) {
                    e.message = e.message.toLowerCase();
                }
                if (stExpected) {
                    stExpected = stExpected.toLowerCase();
                }
                this.assert(!stExpected ||
                            e.name.indexOf(stExpected) != -1 ||
                            e.message.indexOf(stExpected) != -1,
                            "Exception: " + e.name +
                            " (" + e.message + ")" +
                            (stExpected ? " Expecting: " +
                             stExpected : ""));
                this.cThrows++;
            }
            else {
                var stMsg = "Exception: " + e.name + " (" + e.message;
                if (e.number != undefined) {
                    stMsg += ", Error No:" + (e.number & 0xFFFF);
                }
                stMsg += ")";
                if (e.lineNumber != undefined) {
                    stMsg += " @ line " + e.lineNumber;
                }
                this.assert(false, stMsg);
            }
        },

        // asyncSequence - Run a sequence of asynchronous function calls
        // Each fn(ut) must call ut.nextFn() to advance
        // Last call to nextFn calls async(false)
        asyncSequence: function(rgfn) {
            this.rgfn = rgfn;
            this.ifn = 0;
            this.nextFn();
        },

        nextFn: function() {
            if (this.ifn >= this.rgfn.length) {
                this.async(false);
                return;
            }
            this.trace("AsyncSeq: " + (this.ifn + 1));
            try {
                this.rgfn[this.ifn++](this);
            }
            catch (e) {
                this.assertException(e, "", false);
            }
        },

        // Wrap asynchronous function calls so we can catch are report
        // exception errors
        fnWrap: function(fn) {
            var ut = this;
            return function() {
                try {
                    fn.apply(undefined, arguments);
                }
                catch (e) {
                    ut.assertException(e, "", false);
                    // Advance to next function in sequence
                    ut.nextFn();
                }
            };
        }
    }); // UnitTest


    // TestResult - a single result from the test
    function TestResult(f, ut, stNote) {
        this.f = f;
        this.ut = ut;
        this.stNote = stNote;
    }

    // ------------------------------------------------------------------------
    // Test Suite - Holds, executes, and reports on a collection of unit tests.
    // ------------------------------------------------------------------------
    function TestSuite(stName) {
        try {
            this.divOut = this.divOut || document.getElementById("divUnit");
        }
        catch (e) {}

        this.stName = stName;
        this.rgut = [];
        this.stOut = "";
        this.fQuiet = false;
    }

    TestSuite.methods({
        cFailures: 0,
        iReport: 0,
        fStopFail: false,
        fTerminateAll: false,
        iutNext: 0,

        // Will auto-disable any unit test less than iutNext (see skipTo)
        addTest: function(stName, fn) {
            var ut = new ns.UnitTest(stName, fn);
            this.rgut.push(ut);
            // Global setting - stop all unit tests on first failure.
            if (this.fStopFail) {
                ut.stopFail(true);
            }
            return ut;
        },

        addCoverage: function(moduleName) {
            var coverage = new Coverage(moduleName);

            this.addTest("Function Coverage for '" + moduleName + "'",
                         function(ut) {
                             coverage.assertCovered(ut);
                             coverage.unwrap();
                             coverage.logCoverage();
                         });
        },

        stopFail: function(f) {
            this.fStopFail = f;
            return this;
        },

        skipTo: function(iut) {
            // Tests displayed as one-based
            this.iutNext = iut - 1;
            return this;
        },

        // We support asynchronous tests - so we use a timer to kick off
        // tests when the current one is complete.
        run: function(fnCallback) {
            this.out("Test Suite: " + this.stName).newLine();
            this.out("===========================================").newLine();
            this.cFailures = 0;

            this.fnCallback = fnCallback;
            this.tmRun = new timer.Timer(100, this.runNext.fnMethod(this));
            this.tmRun.repeat().active(false);
            this.iCur = 0;
            // Don't wait for timer - start right away.
            this.runNext();
        },

        runNext: function() {
            if (this.iCur == this.rgut.length) {
                this.endOfSuite();
                return;
            }
            loop:
            while (this.iCur < this.rgut.length) {
                var ut = this.rgut[this.iCur];
                var state = ut.state;
                if (!ut.fEnable ||
                    this.fTerminateAll ||
                    this.iCur < this.iutNext) {
                    state = UnitTest.states.completed;
                }
                switch (state) {
                case UnitTest.states.created:
                    ut.run();
                    break;
                case UnitTest.states.running:
                    break loop;
                case UnitTest.states.completed:
                    this.reportOne(this.iCur);
                    this.iCur++;
                    // Skip all remaining tests on failure if stopFail
                    if (this.fStopFail && ut.cErrors != ut.cErrorsExpected) {
                        this.fTerminateAll = true;
                    }
                    break;
                }
            }
            if (this.iCur < this.rgut.length) {
                // We must be running an async test.
                this.tmRun.active(true);
            } else {
                this.endOfSuite();
            }
        },

        endOfSuite: function() {
            this.tmRun.active(false);
            this.reportSummary();
            if (this.fnCallback) {
                this.fnCallback();
            }
        },

        allComplete: function() {
            return (this.iCur == this.rgut.length);
        },

        out: function(st) {
            this.stOut += st;
            return this;
        },

        outRef: function(st, url) {
            if (!url) {
                this.out(st);
                return;
            }
            if (this.divOut) {
                this.out("<A target=\"_blank\" href=\"" + url + "\">" +
                         st + "</A>");
            }
            else {
                if (st != url) {
                    this.out(st + " (" + url + ")");
                }
                else {
                    this.out(st);
                }
            }
        },

        newLine: function() {
            if (this.fQuiet) {
                this.stOut = "";
                return;
            }

            if (this.divOut) {
                this.divOut.appendChild(document.createElement("br"));
                var txt = document.createElement("span");
                txt.innerHTML = format.escapeHTML(this.stOut);
                this.divOut.appendChild(txt);
            }
            // Detect Rhino - use print command
            else if (typeof load != 'undefined') {
                print(this.stOut);
            }
            else if (typeof console != 'undefined') {
                console.log(this.stOut);
            }
            else {
                alert(this.stOut);
            }
            this.stOut = "";
            return this;
        },

        reportOne: function(i) {
            var ut = this.rgut[i];
            this.out((i + 1) + ". ");
            switch (ut.state) {
            case UnitTest.states.created:
                this.out("N/A");
                break;
            case UnitTest.states.running:
                if (ut.cAsync > 0) {
                    this.out("RUNNING");
                }
                else {
                    this.out("INCOMPLETE");
                }
                this.cFailures++;
                break;
            case UnitTest.states.completed:
                if (ut.cErrors == ut.cErrorsExpected &&
                    (ut.cTestsExpected == undefined ||
                     ut.cTestsExpected == ut.cAsserts)) {
                    this.out("PASS");
                }
                else {
                    this.out("FAIL");
                    this.cFailures++;
                }
                break;
            }
            this.out(" [");
            this.outRef(ut.stName, ut.urlRef);
            this.out("] ");
            if (ut.state != UnitTest.states.created) {
                this.out(ut.cErrors + " errors out of " +
                         ut.cAsserts + " tests");
                if (ut.cTestsExpected && ut.cTestsExpected != ut.cAsserts) {
                    this.out(" (" + ut.cTestsExpected + " expected)");
                }
            }
            this.newLine();
            for (var j = 0; j < ut.rgres.length; j++) {
                var res = ut.rgres[j];
                if (!res.f) {
                    this.out("Failed: " + res.stNote).newLine();
                }
            }
        },

        reportSummary: function() {
            this.out("===========================================").newLine();
            if (this.cFailures == 0) {
                this.out("Summary: All (" + this.rgut.length + ") tests pass.");
                this.newLine();
            }
            else {
                this.out("Summary: " + this.cFailures + " failures out of " +
                         this.rgut.length + " tests.");
                this.newLine();
            }
            this.newLine();
        },

        // Report results to master unit test, if any.
        reportOut: function() {
            if (!this.allComplete()) {
                return;
            }
            if (typeof window != 'undefined' &&
                window.opener && window.opener.masterTest) {
                var iUnit = parseInt(window.name.replace(/^Unit_/, ""));
                window.opener.masterTest(iUnit, this.cFailures,
                                         this.rgut.length);
            }
        },

        addSubTest: function(stPath) {
            var ut = this.addTest(stPath, this.runSubTest.fnMethod(this));
            ut.async(true).reference(stPath);
            ut.stPath = stPath;
            ut.iUnit = this.rgut.length - 1;
            return ut;
        },

        runSubTest: function(ut) {
            var stName = "Unit_" + ut.iUnit;
            // Ensure unique name even if multi-level of master-child tests.
            if (window.name) {
                stName += " from " + window.name;
            }
            ut.win = window.open(ut.stPath, "Unit_" + ut.iUnit);
            if (window.masterTest == undefined) {
                window.masterTest = this.masterTest.fnMethod(this);
            }
        },

        masterTest: function(iUnit, cErrors, cTests) {
            var ut = this.rgut[iUnit];
            ut.cErrors = cErrors;
            ut.cAsserts = cTests;
            ut.async(false);
            if (ut.cErrors == ut.cErrorsExpected) {
                ut.win.close();
            }
        }
    }); // TestSuite

    Coverage.methods({
        wrapFunc: function(name, func) {
            if (this.called[name] != undefined) {
                throw new Error("Function already wrapped: " + name);
            }

            this.called[name] = 0;

            return this.onCall.fnMethod(this).fnArgs(name).fnWrap(func);
        },

        onCall: function(self, fn, args, name) {
            this.cover(name);
            return fn.apply(self, args);
        },

        // Mark names as "covered".
        cover: function() {
            for (var i = 0; i < arguments.length; i++) {
                name = arguments[i];
                if (this.called[name] == undefined) {
                    throw new Error("Unwrapped function: " + name);
                }
                this.called[name]++;
            }
        },

        unwrap: function() {
            for (var name in this.funcs) {
                if (this.funcs.hasOwnProperty(name)) {
                    var func = this.funcs[name];
                    this.ns[name] = func;
                    var methods = this.methods[name];
                    for (var method in methods) {
                        if (methods.hasOwnProperty(method)) {
                            func.prototype[method] = methods[method];
                        }
                    }
                }
            }
        },

        assertCovered: function(ut) {
            for (var name in this.called) {
                if (this.called.hasOwnProperty(name)) {
                    ut.assert(this.called[name] > 0,
                              "Coverage - function not called: " +
                              this.name + '.' + name);
                }
            }
        },

        logCoverage: function() {
            console.log("Function coverage for " + this.name + ":");
            for (var name in this.called) {
                if (this.called.hasOwnProperty(name)) {
                    console.log(format.fixedDigits(this.called[name], 3) +
                                ' calls to ' + name);
                }
            }
        }
    });

    // Run the selected tests in the browser
    function runTest(testModule, fnCallback) {
        if (!testModule.addTests) {
            alert("Module " + testModule._path +
                  " has no addTests() function.");
            return;
        }

        var ts = new ns.TestSuite(testModule._path);

        testModule.addTests(ts);
        if (testModule.coverageTargets != undefined) {
            for (var i = 0; i < testModule.coverageTargets.length; i++) {
                ts.addCoverage(testModule.coverageTargets[i]._path);
            }
        } else {
            ts.addCoverage(testModule._parent._path);
        }

        ts.run(fnCallback);
    }

    function loadAndRunTest(path, locations, fnCallback) {
        loader.loadNamespace(path + '.test', locations, function () {
            var testModule = namespace.lookup(path + '.test');
            if (!testModule._isDefined) {
                alert("Module " + path + " is not loaded.");
                return;
            }
            runTest(testModule, fnCallback);
        });
    }

    ns.extend({
        'runTest': runTest,
        'loadAndRunTest': loadAndRunTest,
        'TestSuite': TestSuite,
        'UnitTest': UnitTest,
        'TestResult': TestResult,
        'Coverage': Coverage
    });

}); // startpad.unit
