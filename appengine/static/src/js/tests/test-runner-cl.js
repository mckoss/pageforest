/*jslint rhino:true */

load("../namespace.js");
load("../base.js");
load("../unit.js");
load("../timer.js");
load("../vector.js");
load("../format.js");

(function(a) {
    var unit = namespace.lookup('org.startpad.unit');

    var cTests = 0;
    var cFailures = 0;
    var msStart;
    var fQuiet = false;

    function msNow() {
        var d = new Date();
        return d.getTime();
    }

    function secs(ms) {
        return (ms / 1000).toString();
    }

    function printSummary() {
        print("Ran " + cTests + " tests in " + secs(msNow() - msStart) + 's');
    }

    msStart = msNow();

    var tests = {
        namespace: {ns: 'org.startpad.namespace.test'},
        base: {ns: 'org.startpad.base.test'},
        vector: {ns: 'org.startpad.vector.test'},
        format: {ns: 'org.startpad.format.test'}
    };

    if (a.length < 1) {
        print("Usage: test-runner-cl.js [-q] module ...");
        print("-q: quiet mode - print only final summary.");
        quit(1);
    }

    for (var index = 0; index < a.length; index++) {
        var target = a[index];

        if (target.indexOf('-') === 0) {
            var option = target.substr(1);
            if (option != 'q') {
                print("Unsupported option: " + target);
                quit(1);
            }
            fQuiet = true;
            continue;
        }

        if (!fQuiet) {
            print("Running test: " + target);
        }
        var ts = new unit.TestSuite();
        ts.fQuiet = fQuiet;

        load('test-' + target + '.js');
        var testModule = namespace.lookup(tests[target].ns);

        testModule.addTests(ts);
        ts.run();
        cTests += ts.rgut.length;
        cFailures = ts.cFailures;
        ts.report();
        if (ts.cFailures > 0) {
            printSummary();
            quit(1);
        }
    }
    printSummary();
}(arguments));
