namespace.lookup('com.pageforest.mandelbrot').defineOnce(function (ns) {
    // http://en.wikipedia.org/wiki/Mandelbrot_set

    function Mandelbrot() {
        this.maxIterations = 1000;
        this.xMin = -2;
        this.xMax = 1;
        this.yMin = -1.5;
        this.yMax = 1.5;

        // Color of in-set pixels
        this.setColor = [0, 0, 0, 255];
        // level, R, G, B, A - interpolated
        this.levelColors = [
            [0, [0, 0, 0, 255]],
            [20, [255, 0, 0, 255]],
            [40, [0, 0, 255, 255]],
            [60, [0, 255, 0, 255]],
            [1000, [255, 255, 255, 255]]
        ];
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
        },

        colorFromLevel: function(level) {
            if (level == undefined) {
                return this.setColor;
            }
            var iMin = 0;
            var iMax = this.levelColors.length;
            while (iMin < iMax - 1) {
                var iMid = Math.floor((iMin + iMax) / 2);
                var levelT = this.levelColors[iMid][0];
                if (levelT == level) {
                    return this.levelColors[iMid][1];
                }
                if (levelT < level) {
                    iMin = iMid;
                }
                else {
                    iMax = iMid;
                }
            }

            var levelMin = this.levelColors[iMin][0];
            var levelMax = this.levelColors[iMax][0];
            var p = (level - levelMin) / (levelMax - levelMin);

            var color = [];
            for (var i = 0; i < 4; i++) {
                var cMin = this.levelColors[iMin][1][i];
                var cMax = this.levelColors[iMax][1][i];
                color[i] = Math.floor(cMin + p * (cMax - cMin) + 0.5);
            }

            return color;
        },

        drawTile: function(ctx, xLeft, yTop, dx, dy,
                           xCanvas, yCanvas, cx, cy) {
            dx = dx / cx;
            dy = dy / cy;

            ctx.fillStyle = "red";
            var bitmap = ctx.createImageData(cx, cy);

            var y = yTop;
            var ib = 0;
            var rgba;
            for (var iy = 0; iy < cy; iy++) {
                var x = xLeft;
                for (var ix = 0; ix < cx; ix++) {
                    var iters = this.iterations(x, y);
                    rgba = this.colorFromLevel(iters);
                    for (var i = 0; i < 4; i++) {
                        bitmap.data[ib++] = rgba[i];
                    }
                    x += dx;
                }
                y -= dy;
            }
            ctx.putImageData(bitmap, 0, 0);
        }
    });

    ns.extend({
        'Mandelbrot': Mandelbrot
    });
});
