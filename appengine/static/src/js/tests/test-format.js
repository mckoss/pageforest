namespace.lookup('org.startpad.format.test').defineOnce(function (ns) {
    var format = namespace.lookup('org.startpad.format');

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
            var tests = [[100, '100'],
                         [-100, '-100'],
                         [1000, '1,000'],
                         [-1000, '-1,000'],
                         [1000000, '1,000,000']];
            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(format.thousands(test[0]), test[1]);
            }
            ut.assertEq(format.thousands(1000, 2), '1,000.00');
        });

        ts.addTest("fixedDigits", function (ut) {
            ut.assertEq(format.fixedDigits(1,2), "01");
            ut.assertEq(format.fixedDigits(11, 10), "0000000011", "long numbers");
            ut.assertEq(format.fixedDigits(123, 2), "23", "overflow");
            ut.assertEq(format.fixedDigits(12.34, 2), "12", "fractions");
            ut.assertEq(format.fixedDigits(-1, 2), "-01", "negative numbers");
        });

        ts.addTest("slugify", function (ut) {
            var tests = [["hello", "hello"],
                         ["hello mom", "hello-mom"],
                         ["DON'T YELL", "don-t-yell"],
                         ["   mr. doo_little  ", "mr-doo-little"],
                         ["keep 5 numb3rs", "keep-5-numb3rs"],
                         ["no!crazy!!:\\\puncuation's?", "no-crazy-puncuation-s"]
                        ];
            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(format.slugify(test[0]), test[1]);
            }
        });

        ts.addTest("ISO 8601 Formatting", function(ut)
        {
            var aTest = [
                [[1960, 8, 31], [0,0,0,0], "1960-08-31"],
                [[1960, 8, 31], [7,8], "1960-08-31T07:08Z"],
                [[1960, 8, 31], [7,8,9,333], "1960-08-31T07:08:09.333Z"]
            ];

            var dt = new Date();
            ut.assertEq(dt.getTime(), dt.valueOf(), "Javascript assumption");
            var sISO = format.iso(dt);
            var sTZ = format.fixedDigits(-dt.getTimezoneOffset()/60, 2);
            ut.assertEq(sISO.substring(sISO.length-3), sTZ, "Timezone");

            // Fix dt as a UTC date/time
            dt.__tz = 0;
            sISO = format.iso(dt);
            ut.assertEq(sISO.substring(sISO.length-1), "Z", "Timezone - fixed at UTC: " + sISO);
            for (var i = 0; i < aTest.length; i++)
                {
                ut.Trace(i);
                var aDate = aTest[i][0];
                aDate[1]--;
                var aTime = aTest[i][1];
                var sISO = aTest[i][2];
                dt.setUTCFullYear.apply(dt, aDate);
                dt.setUTCHours.apply(dt, aTime);
                ut.assertEq(format.iso(dt), sISO);
                }

            dt.setUTCFullYear(1995, 0, 15);
            dt.setUTCHours(0,0,0,0);
            ut.assertEq(format.iso(dt, true), "1995-01-15T00:00Z");
        }).enable(false);

        ts.addTest("ISO 8601 Parsing", function(ut)
        {
            var dt = new Date();

            var aTest = [
            // ISO, UTC: [Y,M,D], [h,m,s,ms], tz
            ["1984-01-01", [1984, 1, 1], [0,0,0,0], 0],
            ["", undefined],
            ["1984", undefined],
            ["1984-01", undefined],
            ["1984-01-01T01:02:03.456-07", [1984,1,1], [8,2,3,456], -7],
            ["1984-01-01T01:02:03.456Z", [1984,1,1], [1,2,3,456], 0],
            ["19840101T010203.456Z", [1984,1,1], [1,2,3,456], 0],
            ["19840101 010203.456Z", undefined],
            ["1984-01-01T01:02:03X456-07", undefined]
            ];

            for (var i = 0; i < aTest.length; i++)
                {
                ut.Trace(i);
                var aDate = aTest[i][1];
                if (!aDate)
                    {
                    ut.assertEq(format.parseISO(aTest[i][0]), undefined);
                    continue;
                    }
                aDate[1]--;
                var aTime = aTest[i][2];
                dt.setUTCFullYear.apply(dt, aDate);
                dt.setUTCHours.apply(dt, aTime);
                dt.__tz = aTest[i][3];
                ut.assertEq(format.parseISO(aTest[i][0]), dt);
                }
        }).enable(false);

    }; // addTests

});  // org.startpad.format.test
