namespace.lookup('com.pageforest.mandelbrot.test').defineOnce(function (ns) {
    var mandelbrot = namespace.lookup('com.pageforest.mandelbrot');
    var base = namespace.lookup('org.startpad.base');

    var nsSymbols = ['Mandelbrot', 'initWorkers',
                     '_isDefined', '_referenced', '_parent', '_path', 'test'];

    var mandelbrotSymbols = ['iterations', 'colorFromLevel', 'levelFromColor',
                             'render', 'renderData', 'renderKey',
                             'rgbaFromColor', 'tileName'];

    function addTests(ts) {
        ts.addTest("Contract", function(ut) {
            var Mandelbrot = mandelbrot.Mandelbrot;
            ut.assertEq(typeof(Mandelbrot), 'function');

            for (var i = 0; i < mandelbrotSymbols.length; i++) {
                var symbol = mandelbrotSymbols[i];
                ut.assert(Mandelbrot.prototype[symbol] != undefined,
                          "Missing api: Mandelbrot." + symbol);
                ut.assertEq(typeof Mandelbrot.prototype[symbol], 'function',
                            symbol);
            }
        });

        ts.addTest("Undocumented Exports", function(ut) {
            var Mandelbrot = mandelbrot.Mandelbrot;
            for (var prop in mandelbrot) {
                if (mandelbrot.hasOwnProperty(prop)) {
                    ut.assert(nsSymbols.indexOf(prop) != -1,
                                "Undocumented symbol: " + prop);
                }
            }

            for (prop in Mandelbrot.prototype) {
                if (Mandelbrot.prototype.hasOwnProperty(prop)) {
                    ut.assert(mandelbrotSymbols.indexOf(prop) != -1,
                              "Undocument method: Mandelbrot." + prop);
                }
            }
        });

        ts.addTest("Iter Samples", function(ut) {
            var m = new mandelbrot.Mandelbrot();
            var inSet = [[0, 0], [0, 1], [0, -1],
                         [-2, 0]];
            var outSet = [[1, 0], [2, 0], [-2.1, 0],
                          [0, 2], [0, -2], [2, 2]];
            var i;
            var p;

            for (i = 0; i < inSet.length; i++) {
                p = inSet[i];
                ut.assertEq(m.iterations(p[0], p[1]), m.maxIterations,
                            p[0] + ', ' + p[1]);
            }

            for (i = 0; i < outSet.length; i++) {
                p = outSet[i];
                ut.assert(m.iterations(p[0], p[1]) != m.maxIterations);
            }
        });

        ts.addTest("Vertical Symmetry", function(ut) {
            var m = new mandelbrot.Mandelbrot();

            for (var i = 0; i < 100; i++) {
                var x = base.randomInt(100) / 100 - 0.5;
                var y = base.randomInt(100) / 100;

                var iters = m.iterations(x, y);
                ut.assertEq(iters, m.iterations(x, -y));
            }
        });

        ts.addTest("Raw Speed Test", function(ut) {
            var m = new mandelbrot.Mandelbrot();
            var msStart = new Date().getTime();
            var cInSet = 0;

            var dx = (m.xMax - m.xMin) / 255;
            var dy = m.yMax / 255;
            var y = m.yMax;
            for (var iy = 0; iy < 256; iy++) {
                var x = m.xMin;
                for (var ix = 0; ix < 256; ix++) {
                    var iters = m.iterations(x, y);
                    if (iters == m.maxIterations) {
                        cInSet++;
                    }
                    x += dx;
                }
                y -= dy;
            }

            var msElapsed = new Date().getTime() - msStart;
            var area = 2 * cInSet * dx * dy;
            console.log("area = " + area + " (" + msElapsed + "ms)");
            ut.assert(msElapsed < 1000, "Too slow: " + msElapsed + "ms");
            var error = Math.abs(1.50659 - area);
            ut.assert(error < 0.2, "Area error: " + error);
        });

        ts.addTest("Color Invertibility", function(ut) {
            var m = new mandelbrot.Mandelbrot();

            // Confirm colors assignment are invertible.
            for (var level = 0; level <= m.maxIterations; level++) {
                ut.assertEq(m.levelFromColor(m.colorFromLevel(level)), level);
            }
        });

        ts.addTest("rgba", function(ut) {
            var m = new mandelbrot.Mandelbrot();
            var regex = /^rgba\((\d+,){3}\d+\)$/;
            for (var level = 0; level <= this.maxIterations; level += 100) {
                var color = m.colorFromLevel(color);
                var rgba = m.rgbaFromColor(color);
                ut.assert(regex.test(rgba), rgba);
            }
        });

        ts.addTest("tileName", function(ut) {
            var m = new mandelbrot.Mandelbrot();
            var tests = [
                [{x: 0, y: 0}, 0, "0.png"],
                [{x: 0, y: 1}, 0, undefined],
                [{x: 2, y: 0}, 1, undefined],
                [{x: -5, y: 0}, 1, undefined],
                [{x: 20, y: 1}, 4, undefined],
                [{x: 0, y: 0}, 2, "000.png"],
                [{x: 1, y: 0}, 2, "001.png"],
                [{x: 0, y: 1}, 2, "002.png"],
                [{x: 1, y: 1}, 2, "003.png"],
                [{x: 2, y: 2}, 2, "030.png"],
                [{x: 3, y: 3}, 2, "033.png"],
                [{x: 3, y: 0}, 2, "011.png"],
                [{x: 0, y: 3}, 2, "022.png"]
            ];

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(m.tileName(test[0], test[1]), test[2], i);
            }

        });
    }

    ns.addTests = addTests;
});
