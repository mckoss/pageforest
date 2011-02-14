namespace.lookup('org.startpad.debug.test').defineOnce(function (ns) {
    var util = namespace.util;
    var base = namespace.lookup('org.startpad.base');
    var unit = namespace.lookup('org.startpad.unit');
    var debug = namespace.lookup('org.startpad.debug');

    ns.addTests = function (ts) {
        function MockLogger(ut) {
            this.ut = ut;
        }

        MockLogger.methods({
            expect: function (s) {
                this.expected = s;
            },

            log: function (s) {
                if (this.expected) {
                    this.ut.assertEq(s, this.expected);
                    this.expected = undefined;
                }
            }
        });

        function sample(a, b) {
        }

        ts.addTest("getFunctionName", function(ut) {
            ut.assertEq(debug.getFunctionName(sample), "sample");
            ut.assertEq(debug.getFunctionName(function () {}), "anonymous");
        });

        ts.addTest("alias", function(ut) {
            var mockLogger = new MockLogger(ut);
            debug.setLogger(mockLogger);

            var s2 = sample.decorate(debug.alias, "aliasFunction");
            mockLogger.expect("aliasFunction is deprecated - use sample instead.");
            s2();
        });
    };

});
