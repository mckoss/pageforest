namespace.lookup('org.startpad.namespace.test').defineOnce(function(ns) {
    var util = namespace.util;

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
                console.log(ns.x);
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

    }; // addTests

}); // org.startpad.base.test
