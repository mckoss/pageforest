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

        ts.addTest("Storage", function(ut) {
            ts.coverage.cover('Storage');
        });

        ts.addTest("getDocURL", function(ut) {
            var appHost = client.appHost;
            ut.assertEq(appHost.indexOf('scratch.pageforest'), 0);
            var storage = client.storage;
            var url = storage.getDocURL('foo', 'bar');
            ut.assertEq(url.indexOf('http://scratch.'), 0);
            ut.assertEq(url.indexOf('/docs/foo/bar'), url.length - 13);

            var url2 = storage.getDocURL('foo');
            ut.assertEq(url2, url.substr(0, url.length - 3));

            // Should get the document root url
            url = storage.getDocURL();
            ut.assertEq(url.indexOf('http://scratch.'), 0);
            ut.assertEq(url.indexOf('/docs/'), url.length - 6);
        });

        ts.addTest("Docs: put/get/delete", function(ut) {
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
                        client.app.onError = undefined;
                        ut.assertEq(status, "ajax_error/404");
                        ut.nextFn();
                    };
                    client.storage.getDoc('does-not-exist', function(doc) {
                        ut.assert(false, "Should never call callback.");
                        ut.nextFn();
                    });
                },

                function (ut) {
                    // Document deletion not currently supported!
                    client.app.onError = function(status, errorMessage) {
                        client.app.onError = undefined;
                        ut.assertEq(status, 'ajax_error/405');
                        ut.nextFn();
                    };
                    client.storage.deleteDoc('test-storage', function (result) {
                        ut.assertEq(result.status, 200);
                        ut.nextFn();
                    });
                }
            ]);
        }).async();

        ts.addTest("Blobs: put/get/delete", function(ut) {
            client.app.ut = ut;

            function cont(result) {
                ut.assertEq(result.status, 200);
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
                },

                function (ut) {
                    client.storage.deleteBlob('test-storage', 'test-blob',
                        function (result) {
                            ut.assertEq(result.status, 200);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.app.onError = function(status, errorMessage) {
                        client.app.onError = undefined;
                        ut.assertEq(status, "ajax_error/404");
                        ut.nextFn();
                    };
                    client.storage.getBlob('test-storage', 'test-blob',
                                           undefined,
                        function (result) {
                            ut.assert(false, "unreachable");
                        });
                }
            ]);
        }).async();

        ts.addTest("list", function(ut) {
            client.app.ut = ut;

            function cont(result) {
                ut.assertEq(result.status, 200);
                ut.nextFn();
            }

            ut.asyncSequence([
                function (ut) {
                    client.storage.putBlob('test-storage', 'test-blob1',
                                           testBlob, undefined, cont);
                },

                function (ut) {
                    client.storage.putBlob('test-storage', 'test-blob2',
                                           testBlob, undefined, cont);
                },

                function (ut) {
                    // List of documents
                    client.storage.list(undefined, undefined,
                        function (result) {
                            ut.assertType(result, 'object');
                            ut.assertType(result['test-storage'], 'object');
                            ut.nextFn();
                        });
                },

                function (ut) {
                    // List of blobs
                    client.storage.list('test-storage', {},
                        function (result) {
                            ut.assertType(result, 'object');
                            ut.assertType(result['test-blob1'], 'object');
                            ut.assertType(result['test-blob2'], 'object');
                            ut.nextFn();
                        });
                }
            ]);
        }).async();
    }

    ns.addTests = addTests;
});
