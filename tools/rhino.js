// Adapted from http://www.jslint.com/rhino/rhino.js
// Original (c) 2002 Douglas Crockford (www.JSLint.com)

/*global JSLINT */
/*jslint rhino: true, strict: false */

(function (a) {
    var e, i, input;
    if (!a[0]) {
        print("Usage: jslint.js file.js ...");
        quit(1);
    }
    for (var index = 0; index < a.length; index++) {
        var filename = a[index];
        input = readFile(filename);
        if (!input) {
            print("jslint: Couldn't read " + filename + "");
            quit(1);
        }
        var options = {eqeqeq: true, immed: true, newcap: true, nomen: true,
                       regexp: true, rhino: true, undef: true, white: true,
                       maxlen: 78};
        if (!JSLINT(input, options)) {
            for (i = 0; i < JSLINT.errors.length; i += 1) {
                e = JSLINT.errors[i];
                if (e) {
                    print(filename + ':' + e.line + ':' + e.character +
                          ': ' + e.reason);
                    // print((e.evidence || '').
                    //     replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1"));
                    print('');
                }
            }
            quit(2);
        }
    }
}(arguments));
