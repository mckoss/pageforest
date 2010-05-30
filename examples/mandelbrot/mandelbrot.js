namespace.lookup('com.pageforest.mandelbrot').defineOnce(function (ns) {
    // http://en.wikipedia.org/wiki/Mandelbrot_set

    function Mandelbrot() {
        this.maxIterations = 1000;
        this.xMin = -2;
        this.xMax = 1;
        this.yMin = -1.5;
        this.yMax = 1.5;
    }

    Mandelbrot.methods({
        iterations: function (x0, y0) {
            if (y0 < 0) {
                y0 = -y0;
            }
            var x = x0;
            var y = y0;
            var xT;

            var x2 = x * x;
            var y2 = y * y;

            // Filter out points in the main cardiod
            if (-0.75 < x && x < 0.38 && y < 0.66) {
                var q = (x - 0.25) * (x - 0.25) + y2;
                if (q * (q + x - 0.25) < 0.25 * y2) {
                    return undefined;
                }
            }

            // Filter out points in bulb of radius 1/4 around (-1,0)
            if (-1.25 < x && x < -0.75 && y < 0.25) {
                var d = (x + 1) * (x + 1) + y2;
                if (d < 1 / 16) {
                    return undefined;
                }
            }

            for (var i = 0; i < this.maxIterations; i++) {
                xT = x * x - y * y + x0;
                y = 2 * x * y + y0;
                x = xT;

                if (x * x + y * y > 4) {
                    return i;
                }
            }
            return undefined;
        }
    });

    ns.extend({
        'Mandelbrot': Mandelbrot
    });
});
