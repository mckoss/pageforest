namespace.lookup('com.pageforest.storage.test').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var storage = namespace.lookup('com.pageforest.storage');

    function addTests(ts) {
        ts.addTest("putDoc", function(ut) {
        });
    }

    ns.addTests = addTests;
});
