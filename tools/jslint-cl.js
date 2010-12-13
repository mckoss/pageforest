// Adapted from http://www.jslint.com/rhino/rhino.js
// Original (c) 2002 Douglas Crockford (www.JSLint.com)

/*global JSLINT */
/*jslint rhino: true, strict: false */

load("fulljslint.js");

(function (a) {
    var e, i, input;
    var options = {
        'weak': {
            browser: true,
            debug: true,
            devel: true,
            forin: true,
            laxbreak: true,
            maxerr: 500,
            predef: ['namespace', '$', 'console', 'window']
        },
        'strong': {
            browser: true,
            debug: true,
            devel: true,
            immed: true,
            maxerr: 500,
            maxlen: 110,
            newcap: true,
            nomen: true,
            predef: ['namespace', '$', 'console', 'window'],
            undef: true,
            white: true
        },
        'strict': {
            bitwise: true,
            browser: true,
            eqeqeq: true,
            immed: true,
            maxerr: 500,
            maxlen: 110,
            newcap: true,
            nomen: true,
            predef: ['namespace', '$', 'console', 'window'],
            regexp: true,
            strict: true,
            undef: true,
            white: true
        }
    };
    var defOption = 'strong';

    if (a.length < 1) {
        print("Usage: jslint.js --weak --strong --strict file.js ...");
        quit(1);
    }
    for (var index = 0; index < a.length; index++) {
        var filename = a[index];

        if (filename.indexOf('--') === 0) {
            defOption = filename.substr(2);
            continue;
        }
        input = readFile(filename);
        if (!input) {
            print("jslint: Couldn't read " + filename + "");
            quit(1);
        }
        if (!JSLINT(input, options[defOption])) {
            for (i = 0; i < JSLINT.errors.length; i += 1) {
                e = JSLINT.errors[i];
                if (e) {
                    // Adjust line numbers for prefixed comment above
                    print(filename + ':' + e.line + ':' + e.character +
                          ': ' + e.reason);
                    // print((e.evidence || '').
                    //     replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1"));
                    print('');
                }
            }
        }
    }
}(arguments));
