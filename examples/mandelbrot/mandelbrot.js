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
            var x = 0;
            var y = 0;
            var xT;

            for (var i = 0; i < this.maxIterations; i++) {
                xT = x * x - y * y + x0;
                y = 2 * x * y + y0;
                x = xT;

                if (x * x + y * y > 4) {
                    return i;
                }
            }
            return this.maxIterations;
        }
    });

    ns.extend({
        'Mandelbrot': Mandelbrot
    });
});
