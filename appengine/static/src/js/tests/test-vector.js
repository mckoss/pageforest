namespace.lookup('org.startpad.vector.test').defineOnce(function(ns) {
    var util = namespace.util;
    var unit = namespace.lookup('org.startpad.unit');
    var vector = namespace.lookup('org.startpad.vector');

    ns.addTests = function(ts) {
        ts.addTest("Copy", function(ut) {
            var a = [1, 2, 3];
            var b = vector.copy(a);
            ut.assert(vector.equal(a, b));
            ut.assert(a !== b);
            var c = vector.append(a, b, [7, 8, 9]);
            ut.assert(vector.equal(c, [1, 2, 3, 1, 2, 3, 7, 8, 9]));
            ut.assert(vector.equal(vector.subFrom([2, 2], [1, 1]), [1, 1]));
            ut.assert(!vector.equal([48, 1], [43, 0]));
            ut.assert(!vector.equal([1, [2, 3]], [1, [2, 2]]));
            ut.assert(vector.equal([1, [2, 3]], [1, [2, 3]]));
        });

        ts.addTest("Vector functions", function(ut) {
            var V = vector;
            var vOrig = [1, 2, 3];
            var v = V.copy(vOrig);

            ut.assertEq(v, [1, 2, 3]);
            ut.assert(v !== vOrig, "copy must be distinct");
            vOrig[0] = 4;
            ut.assertEq(v, [1, 2, 3]);
            vOrig = [1, [2, 3], 4];
            v = V.copy(vOrig);
            ut.assert(V.equal(v, [1, [2, 3], 4]));
            vOrig[1][0] = 5;
            ut.assert(V.equal(v, [1, [5, 3], 4]), "only shallow copy");

            var v1 = [2, 5];
            var v2 = [1, 2];
            v = V.add(v1, v2);
            ut.assert(V.equal(v, [3, 7]));
            ut.assertEq(v1, [2, 5], "unmodified args");
            ut.assertEq(v2, [1, 2], "unmodified args");
            v = V.add(v1, v1, v1, v1);
            ut.assertEq(v, [8, 20]);
            v = V.sub(v1, v2);
            ut.assertEq(v, [1, 3]);

            // Vector multiply
            v = V.mult(v1, v2);
            ut.assertEq(v, [2, 10]);

            // Scalar multiply
            v = V.mult(v1, 2);
            ut.assertEq(v, [4, 10]);
            v = V.mult(2, v1);
            ut.assertEq(v, [4, 10]);
            v = V.mult(1, 2, 3);
            ut.assertEq(v, 6);

            // Mixed multiply
            v = V.mult(v1, 2, v2);
            ut.assertEq(v, [4, 20]);

            // Unequal arrays throws
            ut.assertThrows("Mismatched Vector Size", function(ut) {
                v = V.mult([1, 2, 3], [1, 2]);
            });
            ut.assertEq(V.floor([1, 1.2, -0.5]), [1, 1, -1]);
            ut.assertEq(V.dotProduct(v1, v2), 12);
            v = V.addTo(v1, v2);
            ut.assertIdent(v, v1);
            ut.assertEq(v1, [3, 7]);
            v = V.subFrom(v1, v2);
            ut.assertIdent(v, v1);
            ut.assertEq(v1, [2, 5]);
            ut.assertEq(V.max([0, 5], [-1, 10]), [0, 10]);
        }).breakOn(-1);

        ts.addTest("Point and Rect Functions", function(ut) {
            var V = vector;
            var rc = [10, 10, 100, 100];
            ut.assertEq(V.ul(rc), [10, 10]);
            ut.assertEq(V.lr(rc), [100, 100]);
            ut.assertEq(V.size(rc), [90, 90]);
            ut.assertEq(V.ptCenter(rc), [55, 55]);
            ut.assertEq(V.ptCenter(rc, 0), [10, 10]);
            ut.assertEq(V.ptCenter(rc, 1), [100, 100]);
            ut.assertEq(V.ptCenter(rc, 0.2), [28, 28]);
            ut.assertEq(rc, [10, 10, 100, 100]);
            ut.assertEq(V.ptCenter(rc, [0.5, 0.2]), [55, 28]);
            ut.assertEq(V.boundingBox([0, 1], [1, 0]), [0, 0, 1, 1]);
            ut.assertEq(V.boundingBox([0, 0, 1, 1],
                                      [2, 2, 4, 4]),
                        [0, 0, 4, 4]);
        });

        ts.addTest("ptRegistration", function(ut) {
            var rc = [10, 20, 300, 400];
            var tests = [
                ['ul', [10, 20]],
                ['top', [155, 20]],
                ['ur', [300, 20]],
                ['left', [10, 210]],
                ['center', [155, 210]],
                ['right', [300, 210]],
                ['ll', [10, 400]],
                ['bottom', [155, 400]],
                ['lr', [300, 400]]
            ];

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.trace(test[1]);
                ut.assertEq(vector.ptRegistration(rc, i), test[1]);
                ut.assertEq(vector.ptRegistration(rc, test[0]), test[1]);
            }
        });

        ts.addTest("alignRect", function(ut) {
            // A 2x2 rectangle
            var rc = [11, 12, 13, 14];
            var ptTo = [1, 1];
            var tests = [
                ['ul', [1, 1, 3, 3]],
                ['top', [0, 1, 2, 3]],
                ['ur', [-1, 1, 1, 3]],
                ['left', [1, 0, 3, 2]],
                ['center', [0, 0, 2, 2]],
                ['right', [-1, 0, 1, 2]],
                ['ll', [1, -1, 3, 1]],
                ['bottom', [0, -1, 2, 1]],
                ['lr', [-1, -1, 1, 1]]
            ];
            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.trace(test[0]);
                var rcT = vector.alignRect(rc, test[0], ptTo);
                ut.assertEq(rcT, test[1]);
                ut.assertEq(vector.ptRegistration(rcT, test[0]), [1, 1]);
            }
        });

        ts.addTest("ptInRect", function(ut) {
            var i;
            var test;
            var rc = [10, 10, 30, 30];

            var rangeTests = [
                [[0, 0, 10], true],
                [[-10, 0, 10], false],
                [[5, 0, 10], true],
                [[10, 0, 10], true],
                [[15, 0, 10], false]
            ];

            for (i = 0; i < rangeTests.length; i++) {
                test = rangeTests[i];
                ut.trace(test[0]);
                ut.assertEq(vector.numInRange(test[0][0],
                                              test[0][1],
                                              test[0][2]),
                            test[1]);
            }

            var pointTests = [
                [[10, 10], true],
                [[20, 20], true],
                [[30, 30], true],
                [[0, 0], false],
                [[0, 50], false]
            ];

            for (i = 0; i < pointTests.length; i++) {
                test = pointTests[i];
                ut.trace(test[0]);
                ut.assertEq(vector.ptInRect(test[0], rc), test[1]);
            }
        });

        ts.addTest("clipToRect", function(ut) {
            var i;
            var test;
            var rc = [10, 10, 30, 30];

            var rangeTests = [
                [[0, 0, 10], 0],
                [[-10, 0, 10], 0],
                [[5, 0, 10], 5],
                [[10, 0, 10], 10],
                [[15, 0, 10], 10]
            ];

            for (i = 0; i < rangeTests.length; i++) {
                test = rangeTests[i];
                ut.trace(test[0]);
                ut.assertEq(vector.clipToRange(test[0][0],
                                               test[0][1],
                                               test[0][2]),
                            test[1]);
            }

            var pointTests = [
                [[10, 10], [10, 10]],
                [[20, 20], [20, 20]],
                [[30, 30], [30, 30]],
                [[0, 0], [10, 10]],
                [[0, 50], [10, 30]]
            ];

            for (i = 0; i < pointTests.length; i++) {
                test = pointTests[i];
                ut.trace(test[0]);
                ut.assertEq(vector.ptClipToRect(test[0], rc), test[1]);
            }

            var rcTests = [
                [[10, 10, 30, 30], [10, 10, 30, 30]],
                [[0, 0, 10, 10], [10, 10, 10, 10]],
                [[0, 0, 20, 20], [10, 10, 20, 20]],
                [[15, 15, 25, 25], [15, 15, 25, 25]],
                [[15, 0, 25, 50], [15, 10, 25, 30]],
                [[0, 15, 50, 25], [10, 15, 30, 25]]
            ];

            for (i = 0; i < rcTests.length; i++) {
                test = rcTests[i];
                ut.trace(test[0]);
                ut.assertEq(vector.rcClipToRect(test[0], rc), test[1]);
            }
        });

        ts.addTest("rcExpand", function(ut) {
            var i;
            var test;
            var rc = [10, 10, 30, 30];
            var tests = [
                [[0, 0], [10, 10, 30, 30]],
                [[1, 1], [9, 9, 31, 31]],
                [[10, 10], [0, 0, 40, 40]],
                [[10, 0], [0, 10, 40, 30]],
                [[20, 20], [-10, -10, 50, 50]],
                [[-5, -3], [15, 13, 25, 27]],
                [[-10, -10], [20, 20, 20, 20]],
                [[-100, -100], [20, 20, 20, 20]]
            ];

            for (i = 0; i < tests.length; i++) {
                test = tests[i];
                ut.trace(test[0]);
                ut.assertEq(vector.rcExpand(rc, test[0]), test[1]);
            }
        });

        ts.addTest("keepInRect", function(ut) {
            var i;
            var test;
            var rcOuter = [10, 10, 30, 30];
            var tests = [
                [[10, 10, 30, 30], [10, 10, 30, 30]],
                [[5, 5, 15, 15], [10, 10, 20, 20]],
                [[20, 20, 40, 40], [10, 10, 30, 30]],
                [[0, 0, 100, 100], [10, 10, 30, 30]],
                [[0, 0, 5, 5], [10, 10, 15, 15]]
            ];

            for (i = 0; i < tests.length; i++) {
                test = tests[i];
                ut.trace(test[0]);
                var rc = util.copyArray(test[0]);
                vector.keepInRect(rc, rcOuter);
                ut.assertEq(rc, test[1]);
            }
        });

        ts.addTest("iRegClosest", function(ut) {
            var i;
            var test;
            var rc = [10, 10, 30, 30];
            var tests = [
                [[10, 10], 0],
                [[0, 0], 0],
                [[20, 20], 4],
                [[20, 4], 1],
                [[20, 26], 7],
                [[1000, 20], 5]
            ];

            for (i = 0; i < tests.length; i++) {
                test = tests[i];
                ut.trace(test[0]);
                ut.assertEq(vector.iRegClosest(test[0], rc), test[1]);
            }

        });

        ts.addTest("rectDeltaReg", function(ut) {
            var i;
            var test;
            var rc = [15, 15, 25, 25];
            var rcBounds = [10, 10, 30, 30];
            var ptSizeMin = [5, 5];
            var tests = [
                [[rc, [0, 0], 4, ptSizeMin, rcBounds], rc],
                [[rc, [-5, -5], 4, ptSizeMin, rcBounds], [10, 10, 20, 20]],
                [[rc, [-10, -10], 4, ptSizeMin, rcBounds], [10, 10, 20, 20]],
                [[rc, [-5, -5], 0, ptSizeMin, rcBounds], [10, 10, 25, 25]],
                [[rc, [-10, -10], 0, ptSizeMin, rcBounds], [10, 10, 30, 30]]
            ];

            for (i = 0; i < tests.length; i++) {
                test = tests[i];
                ut.trace(test[0]);
                ut.assertEq(vector.rectDeltaReg.apply(undefined, test[0]),
                            test[1]);
            }
        });

    }; // addTests
});
