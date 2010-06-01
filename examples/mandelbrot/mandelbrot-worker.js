/*globals importScripts, postMessage, onmessage */

importScripts("/lib/beta/js/utils.js",
              "/static/src/js/vector.js",
              "mandelbrot.js");

namespace.lookup('com.pageforest.mandelbrot.worker').defineOnce(function (ns) {
    var mandelbrot = namespace.lookup('com.pageforest.mandelbrot');

    function doRender(evt) {
        var m = new mandelbrot.Mandelbrot();
        var data = [];
        var args = [data].concat(evt.data);
        m.renderData.apply(m, args);
        console.log(data.length);
        postMessage(data);
    }

    ns.extend({
        'doRender': doRender
    });
});

onmessage = namespace.com.pageforest.mandelbrot.worker.doRender;
