namespace.lookup('com.pageforest.storage.test').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var storage = namespace.lookup('com.pageforest.storage');
    var format = namespace.lookup('org.startpad.format');
    var base = namespace.lookup('org.startpad.base');

    var testBlob = {'testNum': 1,
                    'testString': "hello",
                    'testBool': false,
                    'testObj': {'a': 1, 'b': 2},
                    'testArray': [1, 2, 3]
                   };

    var testSha1 = "7a1f1c333b5db916a9c6aea8346efae14f1d324b";

    function TestApp(ut) {
        this.ut = ut;
        this.status = undefined;
    }

    TestApp.methods({
        expectedError: function(status) {
            this.status = status;
        },

        onError: function(status, message) {
            if (!this.status) {
                this.ut.assert(false, "Unexpected error: " + status +
                               " (" + message + ")");
            } else {
                this.ut.assertEq(status, this.status);
                this.status = undefined;
            }
            this.ut.nextFn();
        }
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
            var url = client.storage.getDocURL('foo', 'bar');
            ut.assertEq(url.indexOf('http://scratch.'), 0);
            ut.assertEq(url.indexOf('/docs/foo/bar'), url.length - 13);

            var url2 = client.storage.getDocURL('foo');
            ut.assertEq(url2, url.substr(0, url.length - 3));

            // Should get the document root url
            url = client.storage.getDocURL();
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
                    client.app.expectedError("ajax_error/404");
                    client.storage.getDoc('does-not-exist', function(doc) {
                        ut.assert(false, "Should never call callback.");
                        ut.nextFn();
                    });
                },

                function (ut) {
                    // Document deletion not currently supported!
                    client.app.expectedError("ajax_error/405");
                    client.storage.deleteDoc('test-storage', function (result) {
                        ut.assertEq(result.status, 200);
                        ut.nextFn();
                    });
                }
            ]);
        }).async();

        ts.addTest("Blobs: put/get/delete", function(ut) {
            var etag;

            client.app.ut = ut;

            ut.asyncSequence([
                function (ut) {
                    client.storage.putBlob('test-storage', 'test-blob',
                                           testBlob, undefined,
                        function (result, status, xmlhttp) {
                            etag = storage.getEtag(xmlhttp);
                            ut.assertEq(result.status, 200);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.getBlob('test-storage', 'test-blob',
                                           undefined,
                        function (blob, status, xmlhttp) {
                            ut.assertEq(blob, testBlob);
                            ut.assertEq(storage.getEtag(xmlhttp), etag);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.deleteBlob('test-storage', 'test-blob',
                        function (result) {
                            ut.assertEq(result.status, 200);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.app.expectedError("ajax_error/404");
                    client.storage.getBlob('test-storage', 'test-blob',
                                           undefined,
                        function (result) {
                            ut.assert(false, "unreachable");
                        });
                }

                // TODO: HEAD request
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
                    client.storage.list(undefined, undefined, {},
                        function (result) {
                            ut.assertType(result, 'object');
                            ut.assertType(result['test-storage'], 'object');
                            ut.nextFn();
                        });
                },

                function (ut) {
                    // List of blobs
                    client.storage.list('test-storage', undefined, {},
                        function (result) {
                            ut.assertType(result, 'object');
                            var dir1 = result['test-blob1'];
                            var dir2 = result['test-blob2'];
                            ut.assertType(dir1, 'object');
                            ut.assertType(dir2, 'object');

                            ut.assertEq(dir1.json, true);
                            ut.assertEq(dir1.sha1, testSha1);
                            ut.assertEq(dir1.sha1, dir2.sha1);
                            ut.assertEq(dir1.size, dir2.size);
                            var date1 = format.decodeClass(dir1.modified);
                            var date2 = format.decodeClass(dir2.modified);
                            ut.assertType(date1, Date);
                            ut.assertLT(date1, date2);

                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', undefined,
                                        {keysonly: true},
                        function (result) {
                            ut.assertType(result, 'object');
                            ut.assertEq(result['test-blob1'], {});
                            ut.assertEq(result['test-blob2'], {});
                            ut.nextFn();
                        });
                }

            ]);
        }).async();

        ts.addTest("list prefix and tag", function(ut) {
            client.app.ut = ut;

            console.log("running");

            function cont(result) {
                ut.assertEq(result.status, 200);
                ut.nextFn();
            }

            ut.asyncSequence([
                function (ut) {
                    client.storage.putBlob('test-storage', 'test-tag1',
                                           testBlob, {tags: ['tag1', 'tag2']},
                                           cont);
                },

                function (ut) {
                    client.storage.putBlob('test-storage', 'test-tag2',
                                           testBlob, {tags: ['tag2']},
                                           cont);
                },

                function (ut) {
                    client.storage.list('test-storage', undefined,
                                        {prefix: 'test-b'},
                        function (result) {
                            ut.assertType(result, 'object');
                            ut.assertEq(base.keys(result).length, 2);
                            ut.assert(result.hasOwnProperty('test-blob1'));
                            ut.assert(result.hasOwnProperty('test-blob2'));
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', undefined,
                                        {tag: 'tag2'},
                        function (result) {
                            ut.assertType(result, 'object');
                            ut.assertEq(base.keys(result).length, 2);
                            ut.assert(result.hasOwnProperty('test-tag1'));
                            ut.assert(result.hasOwnProperty('test-tag2'));
                            ut.assertEq(result['test-tag1'].tags,
                                        ['tag1', 'tag2']);
                            ut.assertEq(result['test-tag2'].tags, ['tag2']);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', undefined,
                                        {tag: 'tag1'},
                        function (result) {
                            ut.assertType(result, 'object');
                            ut.assertEq(base.keys(result).length, 1);
                            ut.assert(result.hasOwnProperty('test-tag1'));
                            ut.nextFn();
                        });
                }
            ]);
        }).async();

        ts.addTest("list depth", function(ut) {
            client.app.ut = ut;

            var keys = ["root",
                        "root/child1", "root/child2",
                        "root/child1/child3"];

            ut.asyncSequence([
                function (ut) {
                    var i = 0;

                    function nextBlob() {
                        client.storage.putBlob('test-storage', keys[i],
                                               testBlob, undefined,
                            function (result) {
                                ut.assertEq(result.status, 200);
                                if (++i < keys.length) {
                                    setTimeout(nextBlob, 1);
                                    return;
                                }
                                ut.nextFn();
                            });
                    }

                    nextBlob();
                },

                function (ut) {
                    client.storage.list('test-storage', 'root', {},
                        function (result) {
                            ut.assertEq(base.keys(result).length, 2);
                            ut.assert(result.hasOwnProperty('child1'));
                            ut.assert(result.hasOwnProperty('child2'));
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', 'root', {depth: 1},
                        function (result) {
                            ut.assertEq(base.keys(result).length, 2);
                            ut.assert(result.hasOwnProperty('child1'));
                            ut.assert(result.hasOwnProperty('child2'));
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.list('test-storage', 'root', {depth: 0},
                        function (result) {
                            ut.assertEq(base.keys(result).length, 3);
                            ut.assert(result.hasOwnProperty('child1'));
                            ut.assert(result.hasOwnProperty('child2'));
                            ut.assert(result.hasOwnProperty('child1/child3'));
                            ut.nextFn();
                        });
                }
            ]);
        }).async();

        ts.addTest("push/slice", function(ut) {
            client.app.ut = ut;

            var sliceTests = [[undefined, undefined,
                               [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
                              [-5, undefined, [5, 6, 7, 8, 9]],
                              [undefined, 5, [0, 1, 2, 3, 4]],
                              [2, 7, [2, 3, 4, 5, 6]]
                             ];

            ut.asyncSequence([
                function (ut) {
                    // The test-array might not be created yet...
                    client.app.expectedError("ajax_error/404");
                    client.storage.deleteBlob('test-storage', 'test-array',
                        function (results) {
                            client.app.expectedError();
                            ut.assert(results.status, 200);
                            ut.nextFn();
                        });
                },

                // Push 10 integers into an array
                function (ut) {
                    var i = 0;

                    function nextArg() {
                        client.storage.push('test-storage', 'test-array',
                                            i++, {},
                            function (result) {
                                ut.assertEq(result.status, 200);
                                if (i == 10) {
                                    ut.nextFn();
                                    return;
                                }
                                setTimeout(nextArg, 1);
                            });
                    }

                    nextArg();
                },

                function (ut) {
                    client.storage.getBlob('test-storage', 'test-array', {},
                        function (json) {
                            ut.assertEq(json, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    this.ut = ut;
                    var i = 0;

                    function nextSlice() {
                        var test = sliceTests[i++];
                        console.log('slice ' + i, test[0], test[1]);

                        client.storage.slice('test-storage', 'test-array',
                                             {start: test[0], end: test[1]},
                            function (json) {
                                ut.assertEq(json, test[2]);
                                if (i == sliceTests.length) {
                                    ut.nextFn();
                                    return;
                                }
                                setTimeout(nextSlice, 1);
                            });

                    }
                    nextSlice();
                },

                function (ut) {
                    client.app.expectedError("slice_range");
                    client.storage.slice('test-storage', 'test-array',
                                         {start: 'foo'},
                        function (result) {
                            ut.assert(false, "unreachable");
                        });
                },

                function (ut) {
                    client.app.expectedError("ajax_error/404");
                    client.storage.slice('test-storage', 'does-not-exist',
                                         {start: 0, end: 0},
                        function (result) {
                            ut.assert(false, "unreachable");
                        });
                },

                function (ut) {
                    client.storage.push('test-storage', 'test-array',
                                        "new", {max: 5},
                        function (result) {
                            ut.assertEq(result.newLength, 5);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.getBlob('test-storage', 'test-array', {},
                        function (json) {
                            ut.assertEq(json, [6, 7, 8, 9, "new"]);
                            ut.nextFn();
                        });
                }
            ]);
        }).async();

        ts.addTest("wait", function(ut) {
            var etag;
            var timeStart;

            ut.asyncSequence([
                function (ut) {
                    client.storage.putBlob('test-storage', 'test-wait',
                                           [1, 2, 3, 4, 5], undefined,
                        function (result, status, xmlhttp) {
                            etag = storage.getEtag(xmlhttp);
                            timeStart = new Date().getTime();
                            ut.assertEq(result.status, 200);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.getBlob('test-storage', 'test-wait',
                                           undefined,
                        function (blob, status, xmlhttp) {
                            var time = new Date().getTime();
                            console.log("getTime: " + (time - timeStart));

                            ut.assertLT(time - timeStart, 500);
                            timeStart = time;
                            ut.assertEq(storage.getEtag(xmlhttp), etag);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.getBlob('test-storage', 'test-wait',
                                           {wait: 3},
                        function (blob, status, xmlhttp) {
                            var time = new Date().getTime();
                            console.log("getTime: " + (time - timeStart));

                            ut.assertGT(time - timeStart, 3000);
                            timeStart = time;
                            ut.assertEq(storage.getEtag(xmlhttp), etag);
                            ut.nextFn();
                        });
                },

                function (ut) {
                    client.storage.getBlob('test-storage', 'test-wait',
                                           {wait: 10},
                        function (blob, status, xmlhttp) {
                            var time = new Date().getTime();
                            console.log("getTime: " + (time - timeStart));

                            // Should return within a couple of seconds of
                            // the push changing the blob.
                            ut.assertGT(time - timeStart, 1000);
                            ut.assertLT(time - timeStart, 3500);
                            timeStart = time;
                            ut.assertEq(storage.getEtag(xmlhttp), etag);
                            ut.nextFn();
                        });

                    function doPush() {
                        client.storage.push('test-storage', 'test-wait',
                                            6, undefined);
                    }

                    setTimeout(doPush, 1);
                }

            ]);
        }).async();
    }

    // TODO: Test HEAD

    ns.addTests = addTests;
});
