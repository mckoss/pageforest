namespace.lookup('org.startpad.cookies.test').defineOnce(function (ns) {
    var cookies = namespace.lookup('org.startpad.cookies');
    var base = namespace.lookup('org.startpad.base');
    var unit = namespace.lookup('org.startpad.unit');

    ns.addTests = function (ts) {

        ts.addTest("Cookies", function(ut)
        {
            var x = base.randomInt(100).toString();
            var y = base.randomInt(100).toString();
            cookies.setCookie("c1", x);
            cookies.setCookie("c2", y, 30);

            var obj = cookies.getCookies();

            ut.assertEq(obj.c1, x);
            ut.assertEq(obj.c2, y);
        }).require('document');

    };

});
