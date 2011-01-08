/*jslint rhino: true */
namespace.lookup('org.startpad.loader').defineOnce(function(ns) {
    var base = namespace.lookup('org.startpad.base');
    var dom = namespace.lookup('org.startpad.dom');

    var iTimer;
    var callbacks = [];

    function checkLoaded() {
        for (var i = 0; i < callbacks.length;) {
            var callback = callbacks[i];
            if (callback[0]._isDefined) {
                var fn = callback[1];
                callbacks.splice(i, 1);
                fn();
            }
            else {
                i++;
            }
        }
        if (callbacks.length == 0) {
            clearInterval(iTimer);
            iTimer = undefined;
        }
    }

    // Load a script - and call callback when loaded.
    function loadScript(url, fnCallback) {
        console.log("loading script: " + url + " ...");

        // Rhino supports load directly
        if (typeof load != 'undefined') {
            load(url);
            if (fnCallback) {
                fnCallback();
            }
            return;
        }

        var script = document.createElement("script");
        script.src = url;
        script.type = "text/javascript";

        function loaded() {
            console.log(url + " - loaded.");
            fnCallback();
        }

        // FIXME: This seems to break in Firefox (works in Chrome)
        // Safer to use the timer to trigger callbacks.
        if (fnCallback) {
            dom.bind(script, 'load', loaded);
        }

        document.getElementsByTagName('head')[0].appendChild(script);
    }

    function loadStylesheet(url) {
        var head = document.getElementsByTagName('head')[0];
        var link = document.createElement('link');
        link.rel = "stylesheet";
        link.type = "text/css";
        link.href = url;

        head.appendChild(link);
    }

    // Call the callback once the namespace has been defined
    function waitForNamespace(targetNamespace, fnCallback) {
        if (targetNamespace._isDefined) {
            fnCallback();
            return;
        }

        if (iTimer == undefined) {
            iTimer = setInterval(checkLoaded, 500);
        }

        callbacks.push([targetNamespace, fnCallback]);
    }

    // Load a namespace if it's not already defined. Uses a location
    // map to indicate which files contain each namespace.
    function loadNamespace(name, locations, fnCallback) {
        var targetNamespace = namespace.lookup(name);

        if (!targetNamespace._isDefined) {
            if (locations[name] == undefined) {
                throw new Error("Unknown namespace location: " + name);
            }
            loadScript(locations[name]);
        }

        waitForNamespace(targetNamespace, function () {
            ns.loadReferences(targetNamespace._referenced,
                              locations,
                              fnCallback);
        });
    }

    // Load the  references that haven't yet been defined.
    function loadReferences(nsList, locations, fnCallback) {
        var countRemaining = nsList.length;
        if (countRemaining == 0) {
            fnCallback();
            return;
        }

        var paths = base.map(nsList, function(ns) {
            return ns._path;
        });

        function decrementCount() {
            countRemaining--;
            if (countRemaining == 0) {
                fnCallback();
            }
        }

        for (var i = 0; i < nsList.length; i++) {
            var name = nsList[i]._path;
            loadNamespace(name, locations, decrementCount);
        }
    }

    // Exports.
    ns.extend({
        'loadScript': loadScript,
        'loadStylesheet': loadStylesheet,
        'loadNamespace': loadNamespace,
        'loadReferences': loadReferences
    });
});
