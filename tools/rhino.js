// Adapted from http://www.jslint.com/rhino/rhino.js
// Original (c) 2002 Douglas Crockford (www.JSLint.com)

/*global JSLINT */
/*jslint rhino: true, strict: false */

(function (a) {
    var e, i, input;
    if (!a[0]) {
        print("Usage: jslint.js file.js");
        quit(1);
    }
    input = readFile(a[0]);
    if (!input) {
        print("jslint: Couldn't open file '" + a[0] + "'.");
        quit(1);
    }
    if (!JSLINT(input, {eqeqeq: true, immed: true, newcap: true, nomen: true,
                        regexp: true, rhino: true, undef: true, white: true,
                        maxlen: 78})) {
        for (i = 0; i < JSLINT.errors.length; i += 1) {
            e = JSLINT.errors[i];
            if (e) {
                print(a[0] + ':' + e.line + ':' + e.character +
                      ': ' + e.reason);
                // print((e.evidence || '').
                //     replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1"));
                print('');
            }
        }
        quit(2);
    } else {
        print("jslint: No problems found in " + a[0]);
        quit();
    }
}(arguments));
