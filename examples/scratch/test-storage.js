namespace.lookup('com.pageforest.storage.test').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var storage = namespace.lookup('com.pageforest.storage');

    var testBlob = {'testNum': 1,
                    'testString': "hello",
                    'testBool': false,
                    'testObj': {'a': 1, 'b': 2},
                    'testArray': [1, 2, 3]
                   };

    function TestApp(ut) {
        this.ut = ut;
    }

    TestApp.methods({
    });

    // Anonymous app in this test.
    var client = new clientLib.Client(new TestApp());

    function addTests(ts) {

        ts.addTest("getDocURL", function(ut) {
            ts.coverage.cover('Storage');
            var appHost = client.appHost;
            ut.assertEq(appHost.indexOf('scratch.pageforest'), 0);
            var url = client.getDocURL('foo', 'bar');
            ut.assertEq(url.indexOf('http://scratch.'), 0);
            ut.assertEq(url.indexOf('/foo/bar'), url.length - 8);

            var url2 = client.storage.getDocURL('foo', 'bar');
            ut.assertEq(url, url2);

            url2 = client.getDocURL('foo');
            ut.assertEq(url2, url.substr(0, url.length - 3));
        });

        ts.addTest("putDoc/getDoc", function(ut) {
            client.app.ut = ut;

            function cont() {
                ut.nextFn();
            }

            ut.asyncSequence([
                function (ut) {
                    // Force a login check.
                    ut.assertEq(client.username, undefined,
                                "shouldn't be logged in at startup");
                    client.app.onUserChange = function(username) {
                        client.app.onUserChange = undefined;
                        ut.assertType(username, 'string');
                        ut.assertEq(client.state, 'clean');
                        ut.nextFn();
                    };
                    client.poll();
                },

                function (ut) {
                    client.storage.putDoc('test-storage',
                                          {title: "Test storage document.",
                                           blob: testBlob},
                                          cont);
                },

                function (ut) {
                    client.storage.getDoc('test-storage', function(doc) {
                        ut.assertEq(doc.title, "Test storage document.");
                        ut.assertEq(doc.blob, testBlob);
                        ut.nextFn();
                    });
                },

                function (ut) {
                    client.app.onError = function(status, errorMessage) {
                        ut.assertEq(status, "ajax_error/404");
                        ut.assertEq(errorMessage, "NOT FOUND");
                        ut.nextFn();
                    };
                    client.storage.getDoc('does-not-exist', function(doc) {
                        ut.assert(false, "Should never call callback.");
                        ut.nextFn();
                    });
                }
            ]);
        }).async();

        ts.addTest("putBlob/getBlob", function(ut) {
            client.app.ut = ut;

            function cont() {
                ut.assert(true, "continue");
                ut.nextFn();
            }

            function fnGet(blob) {
                ut.assertEq(blob, testBlob);
                ut.nextFn();
            }

            ut.asyncSequence([
                function (ut) {
                    client.storage.putBlob('test-storage', 'test-blob',
                                           testBlob, undefined, cont);
                },

                function (ut) {
                    client.storage.getBlob('test-storage', 'test-blob',
                                           undefined, fnGet);
                }
            ]);
        }).async();
    }

    ns.addTests = addTests;
});
