namespace.lookup('com.pageforest.mandelbrot').defineOnce(function (ns) {

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

            // Filter out points in bulb of radius 1/4 around (-1,0)
            if (-1.25 < x && x < -0.75 && y < 0.25) {
                var d = (x + 1) * (x + 1) + y * y;
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
