namespace.lookup('com.pageforest.client.test').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');

    function addTests(ts) {

        ts.addTest("Client UI", function(ut) {
            var client = new clientLib.Client(ns);

            // Use the standard Pageforest UI widget.
            client.addAppBar();
        });
    }

    ns.addTests = addTests;
});
