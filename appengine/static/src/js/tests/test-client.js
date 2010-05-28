namespace.lookup('com.pageforest.client.test').defineOnce(function (ns) {
    var client = namespace.lookup('com.pageforest.client');

    var nsSymbols = ['Client', 'pollInterval',
                     '_isDefined', '_referenced', '_parent', '_path', 'test'];

    var clientSymbols = ['load', 'save', 'detach', 'getDocURL',
                         'setLogging', 'setDirty', 'isSaved', 'poll',
                         'signIn', 'signOut'];

    function addTests(ts) {
        ts.addTest("0.6 API Contract", function(ut) {
            var Client = client.Client;
            ut.assertEq(typeof(Client), 'function');

            for (var i = 0; i < clientSymbols.length; i++) {
                var symbol = clientSymbols[i];
                ut.assert(Client.prototype.hasOwnProperty(symbol),
                          "Missing api: Client." + symbol);
                ut.assertEq(typeof Client.prototype[symbol], 'function',
                            symbol);
            }
        });

        ts.addTest("Undocumented exports", function(ut) {
            var Client = client.Client;
            for (var prop in client) {
                if (client.hasOwnProperty(prop)) {
                    ut.assert(nsSymbols.indexOf(prop) != -1,
                                "Undocumented symbol: " + prop);
                }
            }
        });
    }

    ns.addTests = addTests;
});
