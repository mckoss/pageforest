// Adapted from http://www.jslint.com/rhino/rhino.js
// Original (c) 2002 Douglas Crockford (www.JSLint.com)

/*global JSLINT */
/*jslint rhino: true, strict: false */

load("fulljslint.js");

(function (a) {
    var e, i, input;
    if (!a[0]) {
        print("Usage: jslint.js file.js ...");
        quit(1);
    }
    for (var index = 0; index < a.length; index++) {
        var filename = a[index];
        input = readFile(filename);
        input = "/*global global_namespace, $, console */\n" + input;
        if (!input) {
            print("jslint: Couldn't read " + filename + "");
            quit(1);
        }
        var options = {eqeqeq: false, immed: true, newcap: true, nomen: true,
                       regexp: false, rhino: true, undef: true, white: true,
                       maxlen: 80, browser: true};
        if (!JSLINT(input, options)) {
            for (i = 0; i < JSLINT.errors.length; i += 1) {
                e = JSLINT.errors[i];
                if (e) {
                    // Adjust line numbers for prefixed comment above
                    print(filename + ':' + (e.line - 1) + ':' + e.character +
                          ': ' + e.reason);
                    // print((e.evidence || '').
                    //     replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1"));
                    print('');
                }
            }
        }
    }
}(arguments));
