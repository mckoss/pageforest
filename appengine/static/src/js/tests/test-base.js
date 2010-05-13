namespace.lookup('org.startpad.base.test').defineOnce(function (ns) {
    util = namespace.util;
    var base = namespace.lookup('org.startpad.base');

ns.addTests = function (ts) {

ts.addTest("fnMethod", function (ut)
{
    function Base()
    {
        this.x = 7;
    }

    Base.prototype.Double = function()
    {
        this.x *= 2;
    };

    Base.prototype.Mult = function(x)
    {
        this.x *= x;
    };

    var b = new Base();
    var fn = b.Double.fnMethod(b);
    fn();
    ut.assertEq(b.x, 14);

    var fn2 = b.Mult.fnMethod(b);
    fn2(5);
    ut.assertEq(b.x, 14*5);

    var fn5 = b.Mult.fnMethod(b).fnArgs(4);
    fn5();
    ut.assertEq(b.x, 14*5*4);

    // Doesn't matter which order Fn-augmentors are called in!
    var fn6 = b.Mult.fnArgs(3).fnMethod(b);
    fn6();
    ut.assertEq(b.x, 14*5*4*3);

    function TestfnArgs(a,b,c)
    {
        ut.assertEq(arguments.length, 3);
        ut.assertEq(a, 1);
        ut.assertEq(b, 2);
        ut.assertEq(c, 3);
    }

    var fn7 = TestfnArgs.fnArgs(1,2,3);
    fn7();

    // Each fnArgs places it's arguments after it's predecessor.
    var fn8 = TestfnArgs.fnArgs(3).fnArgs(2);
    fn8(1);
});

ts.addTest("String Buffer", function(ut)
{
    var stb1 = new base.StBuf();
    ut.assertEq(stb1.toString(), "");

    stb1.append("hello");
    ut.assertEq(stb1.toString(), "hello");

    stb1.append(", mom");
    ut.assertEq(stb1.toString(), "hello, mom");

    var stb2 = new base.StBuf();
    stb2.append(stb1).append("-").append(stb1);
    stb1.clear();
    ut.assertEq(stb1.toString(), "");
    ut.assertEq(stb2.toString(), "hello, mom-hello, mom");

    var stb3 = new base.StBuf();
    stb3.append("this", ", that", ", the other");
    ut.assertEq(stb3.toString(), "this, that, the other");

    var stb4 = new base.StBuf("initial", " value");
    ut.assertEq(stb4.toString(), "initial value");
});

ts.addTest("Object Extension", function(ut)
{
    var obj1 = {a:1, b:"hello"};
    util.extendObject(obj1, {c:3});
    ut.assertEq(obj1, {a:1, b:"hello", c:3});

    base.extendIfMissing(obj1, {a:2, b:"mom", d:"new property"});
    ut.assertEq(obj1, {a:1, b:"hello", c:3, d:"new property"});

    var obj2 = {};
    util.extendObject(obj2, {a: 1}, {b: 2}, {a: 3});
    ut.assertEq(obj2, {a: 3, b: 2});

    var a = [];
    var b = [1,[2,3],4];
    base.extendDeep(a, b);
    ut.assertEq(a[0], 1);
    ut.assertEq(a[1], [2,3]);
    ut.assertEq(a[2], 4);

    var o1 = {};
    var o2 = {a:1, b:{c:2}};
    var o3 = {d:3};
    base.extendDeep(o1, o2, o3);
    ut.assertEq(o1, {a:1, b:{c:2}, d:3});
    o1.b.c = 99;
    ut.assertEq(o2, {a:1, b:{c:2}});
});

ts.addTest("strip", function(ut)
{
    ut.assertEq(base.strip(" hello, mom "), "hello, mom");
    ut.assertEq(base.strip(" leading"), "leading");
    ut.assertEq(base.strip("trailing "), "trailing");
    ut.assertEq(base.strip("inner space"), "inner space");
    ut.assertEq(base.strip("     "), "");
    ut.assertEq(base.strip("   \r\nWORD\r\n  "), "WORD");
});

ts.addTest("Enum", function(ut)
{
    var e = new base.Enum("a", "b", "c");
    ut.assertEq(e, {a:0, b:1, c:2});
    e = new base.Enum(1, "a", "b", 5, "c");
    ut.assertEq(e, {a:1, b:2, c:5});
    e = new base.Enum();
    ut.assertEq(e, {});

});

}; // addTests

}); // org.startpad.base.test
