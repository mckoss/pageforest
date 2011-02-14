namespace.lookup('org.startpad.debug.test').defineOnce(function (ns) {
    var util = namespace.util;
    var base = namespace.lookup('org.startpad.base');
    var unit = namespace.lookup('org.startpad.unit');
    var debug = namespace.lookup('org.startpad.debug');

    ns.addTests = function (ts) {

        function sample(a, b) {
        }

        ts.addTest("getFunctionName", function(ut) {
            ut.assertEq(debug.getFunctionName(sample), "sample");
            ut.assertEq(debug.getFunctionName(function () {}), "anonymous");
        });
    };

});
