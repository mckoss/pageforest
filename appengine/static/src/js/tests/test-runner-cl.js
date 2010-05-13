load("../namespace.js");
load("../base.js");
load("../unit.js");
load("../timer.js");
load("../vector.js");

(function(a) {
    var unit = namespace.lookup('org.startpad.unit');

    var tests = {
        base: {ns: 'org.startpad.base.test'},
        unit: {ns: 'org.startpad.unit.test'},
        timer: {ns: 'org.startpad.timer.test'},
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
        try {
            ts.run();
        }
        catch (e) {
            for (prop in e) {
                print(prop + ": " + e[prop]);
            }
        }
    }
}(arguments));
