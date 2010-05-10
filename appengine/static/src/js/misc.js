global_namespace.define("com.pageforest.misc", function(ns) {

    ns.strip = function(s) {
        return (s || "").replace(/^\s+|\s+$/g, "");
    };

});
