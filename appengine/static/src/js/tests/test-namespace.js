/*jslint evil:true */

namespace.lookup('org.startpad.namespace.test').defineOnce(function(ns) {
    var util = namespace.util;
    var unit = namespace.lookup('org.startpad.unit');

    ns.addTests = function(ts) {

        ts.addTest("copyArray", function(ut) {
            var x = [1, 2, 3];
            var y = util.copyArray(x);
            ut.assertEq(x, y);
            x[0] = 4;
            ut.assertEq(y[0], 1);

            function dummy() {
                return util.copyArray(arguments);
            }

            x = dummy(1, 2, 3, 4, 5);
            ut.assertEq(x, [1, 2, 3, 4, 5]);
            ut.assertEq(typeof x, 'object');
        });

        ts.addTest("extendObject", function(ut) {
            var x = {a: 1, b: 2};
            var y = {c: 3, d: 4};
            var z = util.extendObject(x, y);
            ut.assertEq(z, {a: 1, b: 2, c: 3, d: 4});
        });

        ts.addTest("methods", function (ut) {
            function Foo() {
                this.x = 0;
            }

            Foo.methods({
                a: function () {
                    this.x++;
                },

                b: function () {
                    this.x--;
                }
            });

            var f = new Foo();
            ut.assertEq(f.x, 0);
            f.a();
            ut.assertEq(f.x, 1);
            f.b();
            ut.assertEq(f.x, 0);
        });

        ts.addTest("lookup and define", function(ut) {
            var i;
            var self = namespace.lookup('org.startpad.namespace.test');
            ut.assertIdent(self, ns);

            function nsDefinition(ns) {
                if (ns.x) {
                    ns.x++;
                }
                else {
                    ns.x = 1;
                }
            }

            for (i = 0; i < 5; i++) {
                namespace.lookup('org.startpad.test').defineOnce(nsDefinition);
            }

            ut.assertEq(namespace.lookup('org.startpad.test').x, 1);

            for (i = 0; i < 5; i++) {
                namespace.lookup('org.startpad.test2').define(nsDefinition);
            }

            ut.assertEq(namespace.lookup('org.startpad.test2').x, 5);
        });

        ts.addTest("namespace names", function (ut) {
            var ns = namespace.lookup('org.start-pad.foo');
            ut.assertEq(ns._path, 'org.start_pad.foo');
            ut.assertIdent(ns, namespace.org.start_pad.foo);
            ut.assertEq(ns.nameOf('x'), 'namespace.org.start_pad.foo.x');
            ns.x = {};
            ut.assertIdent(ns.x, eval(ns.nameOf('x')));
        });

        ts.addTest("_referenced", function (ut) {
            var ns = namespace.lookup('org.startpad.ref').
                defineOnce(function (ns) {
                    var x = namespace.lookup('org.startpad.required');
                });

            ut.assertEq(ns._referenced.length, 1);
            ut.assertIdent(ns._referenced[0],
                           namespace.lookup('org.startpad.required'));
        });

        ts.addTest("fnMethod and fnArgs", function (ut) {
            function Base()
            {
                this.x = 7;
            }

            Base.prototype.Double = function()
            {
                this.x *= 2;
            };

            Base.prototype.Mult = function(x)
            {
                this.x *= x;
            };

            var b = new Base();
            var fn = b.Double.fnMethod(b);
            fn();
            ut.assertEq(b.x, 14);

            var fn2 = b.Mult.fnMethod(b);
            fn2(5);
            ut.assertEq(b.x, 14 * 5);

            var fn5 = b.Mult.fnMethod(b).fnArgs(4);
            fn5();
            ut.assertEq(b.x, 14 * 5 * 4);

            // Doesn't matter which order Fn-augmentors are called in!
            var fn6 = b.Mult.fnArgs(3).fnMethod(b);
            fn6();
            ut.assertEq(b.x, 14 * 5 * 4 * 3);

            function TestfnArgs(a, b, c)
            {
                ut.assertEq(arguments.length, 3);
                ut.assertEq(a, 1);
                ut.assertEq(b, 2);
                ut.assertEq(c, 3);
            }

            var fn7 = TestfnArgs.fnArgs(1, 2, 3);
            fn7();

            // Each fnArgs places it's arguments after it's predecessor.
            var fn8 = TestfnArgs.fnArgs(3).fnArgs(2);
            fn8(1);
        });

    }; // addTests

    ns.extend({
        coverageTargets: [namespace, util]
    });

}); // org.startpad.base.test
