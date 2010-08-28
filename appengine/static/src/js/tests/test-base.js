namespace.lookup('org.startpad.base.test').defineOnce(function (ns) {
    var util = namespace.util;
    var base = namespace.lookup('org.startpad.base');
    var unit = namespace.lookup('org.startpad.unit');

    ns.addTests = function (ts) {

        ts.addTest("String Buffer", function(ut) {
            var stb1 = new base.StBuf();
            ut.assertEq(stb1.toString(), "");

            stb1.append("hello");
            ut.assertEq(stb1.toString(), "hello");

            stb1.append(", mom");
            ut.assertEq(stb1.toString(), "hello, mom");

            var stb2 = new base.StBuf();
            stb2.append(stb1).append("-").append(stb1);
            stb1.clear();
            ut.assertEq(stb1.toString(), "");
            ut.assertEq(stb2.toString(), "hello, mom-hello, mom");

            var stb3 = new base.StBuf();
            stb3.append("this", ", that", ", the other");
            ut.assertEq(stb3.toString(), "this, that, the other");

            var stb4 = new base.StBuf("initial", " value");
            ut.assertEq(stb4.toString(), "initial value");
        });

        ts.addTest("Object Extension", function(ut) {
            var obj1 = {a: 1, b: "hello"};
            util.extendObject(obj1, {c: 3});
            ut.assertEq(obj1, {a: 1, b: "hello", c: 3});

            base.extendIfMissing(obj1, {a: 2, b: "mom", d: "new property"});
            ut.assertEq(obj1, {a: 1, b: "hello", c: 3, d: "new property"});

            var obj2 = {};
            util.extendObject(obj2, {a: 1}, {b: 2}, {a: 3});
            ut.assertEq(obj2, {a: 3, b: 2});

            var a = [];
            var b = [1, [2, 3], 4];
            base.extendDeep(a, b);
            ut.assertEq(a[0], 1);
            ut.assertEq(a[1], [2, 3]);
            ut.assertEq(a[2], 4);

            var o1 = {};
            var o2 = {a: 1, b: {c: 2}};
            var o3 = {d: 3};
            base.extendDeep(o1, o2, o3);
            ut.assertEq(o1, {a: 1, b: {c: 2}, d: 3});
            o1.b.c = 99;
            ut.assertEq(o2, {a: 1, b: {c: 2}});
        });

        ts.addTest("extendIfChanged", function(ut) {
            var tests = [
                [{}, {}, {}, {}, false],
                [{}, {}, {a: 1}, {a: 1}, true],
                [{a: 1}, {a: 1}, {a: 2}, {a: 2}, true],
                [{a: 1}, {a: 2}, {a: 2}, {a: 1}, false],
                [{}, {b: 2}, {a: 1}, {a: 1}, true],
                [{a: 1, b: 2}, {a: 3, b: 3}, {a: 4, b: 3}, {a: 4, b: 2}, true],
                [{a: 1}, {a: 2}, {a: undefined}, {a: 1}, false],
                [{a: 1}, {}, {a: 2}, {a: 2}, true]
            ];

            for (var i = 0; i < tests.length; i++) {
                ut.trace("i = " + i);
                var test = tests[i];
                var dest = test[0];
                ut.assertEq(base.extendIfChanged(dest, test[1],
                                                 test[2]), test[4]);
                ut.assertEq(dest, test[3]);

                // Make sure the "last" cache is updated when changed.
                for (var prop in test[2]) {
                    if (test[2].hasOwnProperty(prop)) {
                        if (test[2][prop] != undefined) {
                            ut.assertEq(test[1][prop], test[2][prop],
                                        "Prop: " + prop);
                        }
                    }
                }
            }
        });

        ts.addTest("strip", function(ut) {
            ut.assertEq(base.strip(" hello, mom "), "hello, mom");
            ut.assertEq(base.strip(" leading"), "leading");
            ut.assertEq(base.strip("trailing "), "trailing");
            ut.assertEq(base.strip("inner space"), "inner space");
            ut.assertEq(base.strip("     "), "");
            ut.assertEq(base.strip("   \r\nWORD\r\n  "), "WORD");
        });

        ts.addTest("Enum", function(ut) {
            var e = new base.Enum("a", "b", "c");
            ut.assertEq(e, {a: 0, b: 1, c: 2});
            ut.assertEq(e.getName(1), 'b');
            e = new base.Enum(1, "a", "b", 5, "c");
            ut.assertEq(e, {a: 1, b: 2, c: 5});
            e = new base.Enum();
            ut.assertEq(e, {});

        });

        ts.addTest("keys", function(ut) {
            var map = {'a': 1, 'b': 2};
            ut.assertEq(base.keys(map), ['a', 'b']);
        });

        ts.addTest("forEach", function(ut) {
            var a = [];
            a[1] = 1;
            a[3] = 2;

            base.forEach(a, function(elt, index) {
                ut.assert(index == 1 || index == 3, "no undefined");
                ut.assertEq(elt, index == 1 ? 1 : 2);
            });

            var obj = {'a': 1, 'b': 2};
            Object.prototype.c = 3;
            base.forEach(obj, function(elt, prop) {
                ut.assert(prop == 'a' || prop == 'b');
                ut.assertEq(elt, prop == 'a' ? 1 : 2);
            });
        });

        ts.addTest("misc", function(ut) {
            ut.assertEq(base.extendObject({a: 1}, {b: 2}), {a: 1, b: 2});
            ut.assertLT(base.randomInt(10), 10);
            ut.assertEq(base.project({a: 1, b: 2}, ['a']), {a: 1});

            var a = [1, 3, 2, 4, 3];

            base.uniqueArray(a);
            ut.assertEq(a, [1, 2, 3, 4]);

            var aT = base.map(a, function(x) {
                return x * 2 + 1;
            });
            ut.assertEq(aT, [3, 5, 7, 9]);

            aT = base.filter(a, function(x) {
                return x > 2;
            });
            ut.assertEq(aT, [3, 4]);

            var s = base.reduce(a, function(x, y) {
                return x * y;
            });
            ut.assertEq(s, 24);

            ut.assert(base.valueInArray('a', ['b', 'a', 'c']));
            ut.assert(!base.valueInArray(1, ['b', 'a', 'c']));
        });

        ts.addTest("ensureArray", function(ut) {
            var tests = [
                [undefined, []],
                [[1], [1]],
                [1, [1]]
            ];

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(base.ensureArray(test[0]), test[1]);
                ut.assert(test[1] instanceof Array);
            }

            function x(a, b, c) {
                ut.assertEq(base.ensureArray(arguments), [1, 2, 3]);
            }

            x(1, 2, 3);
        });

    }; // addTests

}); // org.startpad.base.test
