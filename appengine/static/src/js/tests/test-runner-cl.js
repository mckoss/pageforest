/*jslint rhino:true */

load("../namespace.js");
load("modules.js");
load("../base.js");
load("../unit.js");
load("../timer.js");
load("../format.js");

(function(a) {
    var unit = namespace.lookup('org.startpad.unit');
    var base = namespace.lookup('org.startpad.base');
    var modules = namespace.lookup('com.pageforest.modules');

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

    function ensureNamespaceLoaded(name) {
        // FIXME: Need to load all module dependencies
        // Use loader functions customized for Rhino

        var targetNamespace = namespace.lookup(name);
        if (!targetNamespace._isDefined) {
            var fileName = modules.locations[name];
            // BUG: Rhino does not all catching this error in a try block?
            load(fileName);
        }
        return targetNamespace;
    }

    msStart = msNow();

    if (a.length < 1) {
        print("Usage: test-runner-cl.js [-q] [-a] module ...");
        print("-q: quiet mode - print only final summary.");
        print("-a: all - run all test");
        quit(1);
    }

    for (var index = 0; index < a.length; index++) {
        var target = a[index];

        if (target.indexOf('-') === 0) {
            var option = target.substr(1);
            switch (option) {
            case 'a':
                a = a.concat(base.keys(modules.namespaces));
                break;
            case 'q':
                fQuiet = true;
                break;
            default:
                print("Unsupported option: " + target);
                quit(1);
            }
            continue;
        }

        var targetNamespace = modules.namespaces[target];
        ensureNamespaceLoaded(targetNamespace);
        var testNamespace = targetNamespace + '.test';
        var testModule = ensureNamespaceLoaded(testNamespace);

        if (typeof testModule.addTests == 'undefined') {
            print("Failed to load module " + testNamespace);
            cFailures++;
            continue;
        }

        var ts = new unit.TestSuite(testNamespace);
        ts.fQuiet = fQuiet;

        testModule.addTests(ts);
        ts.run();
        cTests += ts.rgut.length;
        cFailures += ts.cFailures;
    }

    print("Ran " + cTests + " tests in " + secs(msNow() - msStart) + 's' +
          (cFailures != 0 ? " with " + cFailures + " errors." : ""));

    if (cFailures) {
        quit(1);
    }
}(arguments));
