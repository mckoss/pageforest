namespace.lookup('com.pageforest.client.test').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');

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
        getDoc: function() {
            return {'blob': "hello"};
        },

        setDoc: function(json) {
            console.log("setDoc", json);
            this.restore = json;
        },

        onStateChange: function(newState, oldState) {
            this.state = newState;
            console.log(oldState + "->" + newState);

            if (this.expectedState) {
                this.ut.assertEq(newState, this.expectedState);
                this.expectedState = undefined;
                this.ut.nextFn();
            }
        }
    });

    var app = new TestApp();
    var client = new clientLib.Client(app);

    function addTests(ts) {

        ts.addTest("save/load", function(ut) {
            app.ut = ut;
            // Ignore any doc hashtag
            client.detach();
            client.setDirty(false);

            ut.asyncSequence([
                // Make sure we're logged in
                function (ut) {
                    // Force a login check.
                    ut.assertEq(client.username, undefined,
                                "not yet logged in");
                    app.onUserChange = function(username) {
                        app.onUserChange = undefined;
                        ut.assertType(username, 'string');
                        ut.assertEq(client.state, 'clean');
                        ut.nextFn();
                    };
                    client.poll();
                },

                function (ut) {
                    app.expectedState = 'saving';
                    client.save({'blob': testBlob}, 'test-1');
                },

                function (ut) {
                    app.expectedState = 'clean';
                },

                function (ut) {
                    app.expectedState = 'loading';
                    client.load('test-1');
                },

                function (ut) {
                    app.expectedState = 'clean';
                },

                function (ut) {
                    ut.assertEq(app.restore.blob, testBlob);
                    ut.nextFn();
                }

            ]);
        }).async(true);

        ts.addTest("Client UI", function(ut) {
            app.ut = ut;

            // Use the standard Pageforest UI widget.
            client.addAppBar();
        });
    }

    ns.addTests = addTests;
});
