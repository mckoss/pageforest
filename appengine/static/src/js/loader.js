namespace.lookup('org.startpad.loader').defineOnce(function(ns) {
ns.extend({
    loadScript: function(url, fnCallback) {
        var script = document.createElement("script");
        script.src = url;
        script.type = "text/javascript";
        if (fnCallback) {
            script.addEventListener('load', fnCallback);
        }
        document.getElementsByTagName("head")[0].appendChild(script);
    }
});

});
