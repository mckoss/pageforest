load("../namespace.js");
load("../base.js");
load("../unit.js");
load("../timer.js");
load("../vector.js");

(function(a) {
    var unit = namespace.lookup('org.startpad.unit');

    var tests = {
        namespace: {ns: 'org.startpad.namespace.test'},
        base: {ns: 'org.startpad.base.test'},
        vector: {ns: 'org.startpad.vector.test'}
    };

    if (a.length < 1) {
        print("Usage: test-runner-cl.js module ...");
        quit(1);
    }

    for (var index = 0; index < a.length; index++) {
        var target = a[index];

        if (target.indexOf('--') === 0) {
            defOption = target.substr(2);
            continue;
        }

        print(target);
        var ts = new unit.TestSuite();
        load('test-' + target + '.js');
        var testModule = namespace.lookup(tests[target].ns);

        testModule.addTests(ts);
        ts.run();
        ts.report();
        if (ts.cFailures > 0) {
            quit(1);
        }
    }
}(arguments));
