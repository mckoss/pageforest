namespace.lookup('com.pageforest.storage.test').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var storage = namespace.lookup('com.pageforest.storage');

    var client = new clientLib.Client();

    function addTests(ts) {
        ts.addTest("putDoc", function(ut) {
            ut.asyncSequence([
                function (ut) {
                    ut.nextFn();
                }
            ]);

        }).async();
    }

    ns.addTests = addTests;
});
