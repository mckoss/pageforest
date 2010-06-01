namespace.lookup('com.pageforest.mandelbrot').defineOnce(function (ns) {
    // http://en.wikipedia.org/wiki/Mandelbrot_set

    function Mandelbrot() {
        this.maxIterations = 1000;
        this.xMin = -2;
        this.xMax = 0.5;
        this.yMin = -1.25;
        this.yMax = 1.25;

        // level, R, G, B, A - interpolated
        this.levelColors = [
            [0, [0, 8, 107, 255]],        // dark blue background
            [100, [255, 255, 0, 255]],    // yellow
            [200, [255, 0, 0, 255]],      // red
            [400, [0, 255, 0, 255]],      // green
            [600, [0, 255, 255, 255]],    // cyan
            [800, [255, 255, 255, 255]],  // white
            [900, [128, 128, 128, 255]],  // gray
            [1000, [0, 0, 0, 255]]        // black
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
                    return this.maxIterations;
                }
            }

            // Filter out points in bulb of radius 1/4 around (-1,0)
            if (-1.25 < x && x < -0.75 && y < 0.25) {
                var d = (x + 1) * (x + 1) + y2;
                if (d < 1 / 16) {
                    return this.maxIterations;
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
            return this.maxIterations;
        },

        colorFromLevel: function(level) {
            // Interpolate control points in this.levelColors
            // to map levels to colors.
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
            // Make sure we are not overly sensitive to rounding
            var p = (level - levelMin) / (levelMax - levelMin);

            var color = [];
            for (var i = 0; i < 4; i++) {
                var cMin = this.levelColors[iMin][1][i];
                var cMax = this.levelColors[iMax][1][i];
                color[i] = Math.floor(cMin + p * (cMax - cMin));
            }

            return color;
        },

        levelFromColor: function(color) {
            // On-demand compute inversion color table.
            var key;

            if (this.colorLevels == undefined) {
                this.colorLevels = {};
                for (var level = 0; level <= this.maxIterations; level++) {
                    key = this.colorFromLevel(level).join('-');
                    this.colorLevels[key] = level;
                }
            }

            key = color.join('-');
            return this.colorLevels[key];
        },

        rgbaFromColor: function(color) {
            return "rgba(" + color.join(',') + ")";
        },

        renderKey: function(canvas) {
            var ctx = canvas.getContext('2d');
            var width = canvas.width;
            var height = canvas.height;

            for (var x = 0; x < width; x++) {
                var level = Math.floor(this.maxIterations * x / (width - 1));
                ctx.fillStyle = this.rgbaFromColor(this.colorFromLevel(level));
                ctx.fillRect(x, 0, x + 1, height);
            }
        },

        render: function(canvas, xLeft, yTop, dx, dy) {
            var cx = canvas.width;
            var cy = canvas.height;
            var ctx = canvas.getContext('2d');
            var bitmap = ctx.createImageData(cx, cy);

            // Per-pixel step values
            dx = dx / cx;
            dy = dy / cy;

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
