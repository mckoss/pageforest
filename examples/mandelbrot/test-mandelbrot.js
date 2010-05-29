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
            var inSet = [[0, 0], [0, 1], [0, -1]];

            for (var i = 0; i < inSet.length; i++) {
                var p = inSet[i];
                ut.assertEq(m.iterations(p[0], p[1]), m.maxIterations,
                            p[0] + ', ' + p[1]);
            }
        });

        ts.addTest("Vertical symmetry.", function(ut) {
            var m = new mandelbrot.Mandelbrot();

            for (var i = 0; i < 100; i++) {
                var x = base.randomInt(100) / 100 - 0.5;
                var y = base.randomInt(100) / 100;

                var iters = m.iterations(x, y);
                ut.assertEq(iters, m.iterations(x, -y));
            }
        });
    }

    ns.addTests = addTests;
});
