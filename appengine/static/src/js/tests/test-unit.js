/*global illegalFunction */

namespace.lookup('org.startpad.unit.test').defineOnce(function (ns) {
    var timer = namespace.lookup('org.startpad.timer');

    function Sample()
    {
        this.x = 1;
    }

    Sample.prototype.Double = function()
    {
        this.x *= 2;
    };

    ns.addTests = function(ts) {

        ts.addTest("Single Failure", function(ut) {
            ut.assert(true, "true is true");
            ut.assert(false, "this one should fail!");
        }).expect(1, 2);

        ts.addTest("Never Run", function(ut) {
            ut.assert(false, "Disable a failing test.");
        }).enable(false).expect(1, 1).reference("http://mckoss.com");

        ts.addTest("All Pass", function(ut) {
            var s = new Sample();
            ut.assert(s.x == 1, "Constructor");
            s.Double();
            ut.assert(s.x == 2, "Double Test 1");
            s.x = 10;
            s.Double();
            ut.assert(s.x == 20, "Double Test 2");
            ut.assertEval("1+1==2");
            ut.assertGT(2, 1);
            ut.assertGT("Z", "A");
        }).expect(0, 6);

        ts.addTest("All Fail", function(ut) {
            ut.assert(false);
            ut.assertEval("1+1 == 3");
            ut.assertEq(1, 2);
            ut.assertNEq("hello", "hello");
            ut.assertGT(1, 2);
            ut.assertGT(undefined, 2);
            ut.assertGT("A", "Z");
            var x = 7;
            ut.assertFn(function () {
                return x != 7;
            });
            ut.assertFn(function () { });
            illegalFunction();
        }).expect(10, 10);

        ts.addTest("Object Comparison", function(ut) {
            var obj1 = {a: 1, b: 2};
            var obj2 = {a: 1, b: 2};
            var obj3 = {a: 1};
            var obj4 = {a: 1, b: 3};
            var obj5 = {a: 1, b: {c: 2, d: 3}};
            var obj6 = {a: 1, b: {c: 2, d: 3}};

            ut.assertEq(obj1, obj2);
            ut.assertEq(obj1, obj3);        // Fails
            ut.assertEq(obj1, obj4);        // Fails
            ut.assertContains(obj1, obj3);
            ut.assertIdent(obj1, obj2); // Fails
            ut.assertEq(ut.propCount(obj1), 2);
            ut.assertEq(obj5, obj6);
        }).expect(3, 16);

        ts.addTest("Array Comparison", function(ut) {
            ut.assertEq([1, 2], [1, 2]);
            ut.assertEq([1, 2], [2, 1]);
        }).expect(2, 10);

        ts.addTest("Types", function(ut) {
            function Foo() {}

            ut.assertTypes({st: 'hi', n: 1, m: 1.1, f: true,
                            a: [1, 2], o: {a: 1}},
                           {st: 'string', n: 'number', m: 'number',
                            f: 'boolean',
                            a: 'array', o: 'object'});
            ut.assertType([1, 2], Array);
            var f1 = new Foo();
            ut.assertType(f1, Foo);
            ut.assertType(f1, 'object');
        }).expect(0, 12);

        ts.addTest("Async timeout", function(ut) {
            // No call to async(false)
        }).async(true, 100).expect(1, 1);

        ts.addTest("Multiple Async calls", function(ut) {
            new timer.Timer(1000, function () {
                ut.async(false);
            }).active(true);
            new timer.Timer(1000, function () {
                ut.async(false);
            }).active(true);
            new timer.Timer(1000, function () {
                ut.async(false);
            }).active(true);
        }).async(3);

        ts.addTest("asyncSequence", function(ut) {
            var tm = new timer.Timer(1000, function () {
                tm.cAS++;
                ut.nextFn();
            });
            tm.cAS = 0;
            ut.asyncSequence(
                [
                    function (utT) {
                        ut.assert(utT == ut);
                        ut.assert(tm.cAS == 0);
                        tm.active(true);
                    },

                    function (utT) {
                        ut.assert(utT == ut);
                        ut.assert(tm.cAS == 1);
                        tm.active(true);
                    },

                    function (utT) {
                        ut.assert(utT == ut);
                        ut.assert(tm.cAS == 2);
                        tm.active(true);
                    }
                ]);
        }).async(true);

        ts.addTest("Script error expected", function(ut) {
            illegalFunction();
        }).throwsException().expect(0, 1);

        ts.addTest("Some exception expected", function(ut) {
            illegalFunction();
        }).throwsException().expect(0, 1);

        ts.addTest("no exception", function(ut) {
            ut.assert(true);
        }).throwsException().expect(1, 2);

        ts.addTest("Fails: Wrong exception", function(ut) {
            throw new Error("the wrong exception");
        }).throwsException("ReferenceError").expect(1, 1);

        ts.addTest("Multiple Exceptions", function(ut) {
            try {
                illegalFunction();
            }
            catch (e) {
                ut.assertException(e);
            }

            ut.assertThrows(undefined, function(ut1)
                            {
                                ut.assertIdent(ut, ut1);
                                throw new Error("Custom exception");
                            });

            ut.assertThrows("Custom", function (ut)
                            {
                                throw new Error("Custom exception");
                            });
        }).expect(0, 4);

        ts.addTest("Markers and Assert Numbers", function(ut) {
            ut.breakOn(8);
            for (var i = 0; i < 10; i++)
            {
                ut.trace("Trace Name " + i);
                ut.assert(i != 7, "Assert Fails on 7");
            }
        }).expect(1, 10);

    }; // addTests

}); // org.startpad.unit.test
