namespace.lookup('org.startpad.format.test').defineOnce(function (ns) {
    var format = namespace.lookup('org.startpad.format');
    var unit = namespace.lookup('org.startpad.unit');

    ns.addTests = function(ts) {

        ts.addTest("replaceKeys", function(ut)
        {
            ut.assertEq(format.replaceKeys("this is {wow} test", {wow: "foo"}),
                        "this is foo test");
            ut.assertEq(format.replaceKeys("{key} is replaced {key} twice",
                                           {key: "yup"}),
                        "yup is replaced yup twice");
            ut.assertEq(format.replaceKeys("{key} and {key2}", {key: "mom"}),
                        "mom and ");
        });

        ts.addTest("thousands", function (ut) {
            var tests = [[100, undefined, '100'],
                         [-100, undefined, '-100'],
                         [1000, undefined, '1,000'],
                         [-1000, undefined, '-1,000'],
                         [1000000, undefined, '1,000,000'],
                         [1000, 2, '1,000.00'],
                         [0.75, 5, '0.75000'],
                         [0.12345, 3, '0.123']
                        ];
            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(format.thousands(test[0], test[1]), test[2]);
            }
        });

        ts.addTest("fixedDigits", function (ut) {
            ut.assertEq(format.fixedDigits(1, 2), "01");
            ut.assertEq(format.fixedDigits(11, 10), "0000000011",
                        "long numbers");
            ut.assertEq(format.fixedDigits(123, 2), "23", "overflow");
            ut.assertEq(format.fixedDigits(12.34, 2), "12", "fractions");
            ut.assertEq(format.fixedDigits(-1, 2), "-01",
                        "negative numbers");
        });

        ts.addTest("slugify", function (ut) {
            var tests = [["hello", "hello"],
                         ["hello mom", "hello-mom"],
                         ["DON'T YELL", "don-t-yell"],
                         ["   mr. doo_little  ", "mr-doo-little"],
                         ["keep 5 numb3rs", "keep-5-numb3rs"],
                         ["no!crazy!!:\\\\puncuation's?",
                          "no-crazy-puncuation-s"]
                        ];
            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(format.slugify(test[0]), test[1]);
            }
        });

        ts.addTest("escapeHTML", function (ut) {
            var tests = [["<body><h1>This is text.</h1></body>",
             "&lt;body&gt;&lt;h1&gt;This is text.&lt;/h1&gt;&lt;/body&gt;"],
                         ['What about "quotes\'s"?',
                          "What about &quot;quotes&#39;s&quot;?"],
                         ["strings & things", "strings &amp; things"],
                         ["&amp;lth1&ampgt", "&amp;amp;lth1&amp;ampgt"]
                        ];
            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(format.escapeHTML(test[0]), test[1]);
            }
        });

        ts.addTest("replaceString", function(ut) {
            var tests = [
                ["Test string.", "string", "replace", "Test replace."],
                ["Abcabcabc", "abc", "x", "Abcxx"],
                ["No matches", "foo", "bar", "No matches"],
                ["nonono", "no", "", ""]
            ];

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];

                ut.assertEq(format.replaceString(test[0], test[1], test[2]),
                            test[3]);
            }
        });

        ts.addTest("ISO 8601 Formatting", function(ut)
        {
            var aTest = [
                [[1960, 8, 31], [0, 0, 0, 0], "1960-08-31"],
                [[1960, 8, 31], [7, 8], "1960-08-31T07:08Z"],
                [[1960, 8, 31], [7, 8, 9, 333], "1960-08-31T07:08:09.333Z"]
            ];

            var dt = new Date();
            ut.assertEq(dt.getTime(), dt.valueOf(), "Javascript assumption");
            format.setTimezone();
            var sISO = format.isoFromDate(dt);
            var sTZ = format.fixedDigits(-dt.getTimezoneOffset() / 60, 2);
            ut.assertEq(sISO.substring(sISO.length - 3), sTZ, "Timezone");

            // Fix dt as a UTC date/time
            dt.__tz = 0;
            sISO = format.isoFromDate(dt);
            ut.assertEq(sISO.substring(sISO.length - 1), "Z",
                        "Timezone - fixed at UTC: " + sISO);
            for (var i = 0; i < aTest.length; i++) {
                ut.trace(i);
                var aDate = aTest[i][0];
                aDate[1]--;
                var aTime = aTest[i][1];
                sISO = aTest[i][2];
                dt.setUTCFullYear.apply(dt, aDate);
                dt.setUTCHours.apply(dt, aTime);
                ut.assertEq(format.isoFromDate(dt), sISO);
            }

            dt.setUTCFullYear(1995, 0, 15);
            dt.setUTCHours(0, 0, 0, 0);
            ut.assertEq(format.isoFromDate(dt, true), "1995-01-15T00:00Z");
        });

        ts.addTest("ISO 8601 Parsing", function(ut)
        {
            var dt = new Date();

            var aTest = [
                // ISO, UTC: [Y,M,D], [h,m,s,ms], tz
                ["1984-01-01", [1984, 1, 1], [0, 0, 0, 0], 0],
                ["", undefined],
                ["1984", undefined],
                ["1984-01", undefined],
                ["1984-01-01T01:02:03.456-07",
                 [1984, 1, 1], [8, 2, 3, 456], -7],
                ["1984-01-01T01:02:03.456Z",
                 [1984, 1, 1], [1, 2, 3, 456], 0],
                ["19840101T010203.456Z",
                 [1984, 1, 1], [1, 2, 3, 456], 0],
                ["19840101 010203.456Z", undefined],
                ["1984-01-01T01:02:03X456-07", undefined]
            ];

            for (var i = 0; i < aTest.length; i++) {
                ut.trace(i);
                var aDate = aTest[i][1];
                if (!aDate) {
                    ut.assertEq(format.dateFromISO(aTest[i][0]), undefined);
                    continue;
                }
                aDate[1]--;
                var aTime = aTest[i][2];
                dt.setUTCFullYear.apply(dt, aDate);
                dt.setUTCHours.apply(dt, aTime);
                dt.__tz = aTest[i][3];
                ut.assertEq(format.dateFromISO(aTest[i][0]), dt);
            }

            ut.assertEq(new Date(2010, 7, 23, 15, 14, 52),
                        format.decodeClass({__class__: 'Date',
                                            isoformat: '2010-08-23T22:14:52Z'}
                                          ));
        });

        ts.addTest("shortDate", function(ut) {
            var tests = ['1/2/2010',
                         '1/2/2010 3:00 am',
                         '4/5/2010 5:14 pm'];

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(test, format.shortDate(new Date(test)));
            }
            ut.assertEq(undefined, format.shortDate(undefined));
        });

        ts.addTest("wordList", function(ut) {
            var tests = [
                ["a b c", ["a", "b", "c"], "a, b, c"],
                ["a, b, c", ["a", "b", "c"], "a, b, c"],
                ["   hello world  ", ["hello", "world"], "hello, world"],
                ["", [], ""],
                ["  ", [], ""],
                ["a, b, ", ['a', 'b'], "a, b"],
                ["a,,b", ['a', 'b'], "a, b"],
                ["  ,  ,  a   , b  c d,    e,,,  ",
                 ['a', 'b', 'c', 'd', 'e'], "a, b, c, d, e"]
            ];

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                var a = format.arrayFromWordList(test[0]);
                ut.assertEq(test[1], a);
                ut.assertEq(test[2], format.wordList(a));
            }

            ut.assertEq(format.wordList(undefined), "");
        });

        ts.addTest("base64ToString", function(ut) {
            ut.assertEq(format.base64ToString("aGVsbG8="), "hello");
        });

        ts.addTest("canvasToPNG", function(ut) {
            var canvas = document.createElement('canvas');
            canvas.width = 10;
            canvas.height = 10;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = "red";
            ctx.fillRect(0, 0, 10, 10);
            //document.body.appendChild(canvas);
            var png = format.base64ToString(format.canvasToPNG(canvas));
            var header = [137, 80, 78, 71, 13, 10, 26, 10];
            for (var i = 0; i < header.length; i++) {
                ut.assertEq(png.charCodeAt(i), header[i]);
            }
        }).require('document').require('canvas').fallback(function (ut) {
            ts.coverage.cover('canvasToPNG');
        });

    }; // addTests

});  // org.startpad.format.test
