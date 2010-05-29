namespace.lookup('com.pageforest.mandelbrot.test').defineOnce(function (ns) {
    var mandelbrot = namespace.lookup('com.pageforest.mandelbrot');
    var base = namespace.lookup('org.startpad.base');

    var nsSymbols = ['Mandelbrot',
                     '_isDefined', '_referenced', '_parent', '_path', 'test'];

    var mandelbrotSymbols = ['iterations'];

    function addTests(ts) {
        ts.addTest("Contract", function(ut) {
            var Mandelbrot = mandelbrot.Mandelbrot;
            ut.assertEq(typeof(Mandelbrot), 'function');

            for (var i = 0; i < mandelbrotSymbols.length; i++) {
                var symbol = mandelbrotSymbols[i];
                ut.assert(Mandelbrot.prototype.hasOwnProperty(symbol),
                          "Missing api: Mandelbrot." + symbol);
                ut.assertEq(typeof Mandelbrot.prototype[symbol], 'function',
                            symbol);
            }
        });

        ts.addTest("Undocumented exports", function(ut) {
            var Mandelbrot = mandelbrot.Mandelbrot;
            for (var prop in mandelbrot) {
                if (mandelbrot.hasOwnProperty(prop)) {
                    ut.assert(nsSymbols.indexOf(prop) != -1,
                                "Undocumented symbol: " + prop);
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
                ut.assert(m.iterations(p[0], p[1]) < m.maxIterations);
            }
        });

        ts.addTest("Vertical symmetry", function(ut) {
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

            var dx = (m.xMax - m.xMin) / 256;
            var dy = (m.yMax - m.yMin) / 256;
            var y = m.yMin;
            for (var iy = 0; iy < 256; iy++) {
                var x = m.xMin;
                for (var ix = 0; ix < 256; ix++) {
                    var iters = m.iterations(x, y);
                    if (iters == m.maxIterations) {
                        cInSet++;
                    }
                    x += dx;
                }
                y += dy;
            }

            var msElapsed = new Date().getTime() - msStart;
            var area = cInSet / 256 / 256;
            var report = "area = " + area + " (" + msElapsed + "ms)";
            console.log(report);

            ut.assert(msElapsed < 1000, report);
        });
    }

    ns.addTests = addTests;
});
