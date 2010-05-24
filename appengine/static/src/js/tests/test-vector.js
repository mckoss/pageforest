namespace.lookup('org.startpad.vector.test').defineOnce(function(ns) {
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
    }; // addTests
});
