namespace.lookup('com.pageforest.client.test').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');

    var testBlob = {'testNum': 1,
                    'testString': "hello",
                    'testBool': false,
                    'testObj': {'a': 1, 'b': 2},
                    'testArray': [1, 2, 3]
                   };

    function TestApp() {
    }

    TestApp.methods({
        getDoc: function() {
            return {blob: testBlob};
        },

        setDoc: function(json) {
            this.restore = json;
        }
    });

    function addTests(ts) {

        ts.addTest("save/load", function(ut) {
            var app = new TestApp();
            var client = new clientLib.Client(app);

            // Force a login check.
            client.poll();

            ut.asyncSequence([
                function (ut) {
                    client.onUserChange = function(username) {
                        client.onUserChange = undefined;
                        ut.assertType(username, 'string');
                        client.save(testBlob, 'test-1');
                        ut.nextFn();
                    };
                },

                function (ut) {
                    client.onStateChange = function(newState) {
                        ut.assertEq(newState, 'clean');
                        client.load('test-1');
                        ut.nextFn();
                    };
                },

                function (ut) {
                    client.onStateChange = function(newState) {
                        ut.assertEq(newState, 'loaded');
                        ut.nextFn();
                    };
                }

            ]);
        }).async(true);

        ts.addTest("Client UI", function(ut) {
            var app = new TestApp();
            var client = new clientLib.Client(app);

            // Use the standard Pageforest UI widget.
            client.addAppBar();
        });
    }

    ns.addTests = addTests;
});
