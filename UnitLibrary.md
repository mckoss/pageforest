# Introduction #

Pageforest includes a unit testing framework for JavaScript code.  You can execute the unit tests for the Pageforest libraries by visiting http://www.pageforest.com/static/src/js/tests/test-runner.html in your browser.

The unit test runner also supports running individual tests.  These links will run
individual tests for each library in Pageforest:

  * [org.startpad.namespace](http://www.pageforest.com/static/src/js/tests/test-runner.html#namespace)
  * [org.startpad.base](http://www.pageforest.com/static/src/js/tests/test-runner.html#base)
  * [org.startpad.unit](http://www.pageforest.com/static/src/js/tests/test-runner.html#unit)
  * [org.startpad.timer](http://www.pageforest.com/static/src/js/tests/test-runner.html#timer)
  * [org.startpad.vector](http://www.pageforest.com/static/src/js/tests/test-runner.html#vector)
  * [org.startpad.format](http://www.pageforest.com/static/src/js/tests/test-runner.html#format)
  * [org.startpad.cookies](http://www.pageforest.com/static/src/js/tests/test-runner.html#cookies)
  * [org.startpad.dialog](http://www.pageforest.com/static/src/js/tests/test-runner.html#dialog)
  * [org.startpad.dom](http://www.pageforest.com/static/src/js/tests/test-runner.html#dom)
  * [org.pageforest.client](http://scratch.pageforest.com/test-runner.html#client)

# Test Runner #

To set up your own application unit tests in the browser, copy the files [test-runner.html](http://scratch.pageforest.com/test-runner.html)
and [test-scratch.js](http://scratch.pageforest.com/test-scratch.js) to your application.

Change the name of test-scratch.js, to test-YOURAPPNAME.js and modify the namespace to:

```
namespace.lookup('com.pageforest.YOURAPPNAME.test').defineOnce(function (ns) {
    function addTests(ts) {

        ts.addTest("YOURAPPNAME Unit Test 1", function(ut) {
            ut.assert(true);
        });
    }

    ns.extend({
        'addTests': addTests
    });
});
```

You'll modify test-runner.html to include the namespace(s) you want to test.  The scratch example
tests the namespaces, com.pageforest.scratch, and com.pageforest.client (you can remove the latter from your test):

```
...
<script type="text/javascript" src="test-YOURAPPNAME.js"></script>
</head>

<body onload="run();">
<h1 id="title"><script>document.write(document.title);</script></h1>

<script>
var appTest = namespace.lookup('com.pageforest.YOURAPPNAME.test');
var unit = namespace.lookup('org.startpad.unit');

function run() {
    unit.runTest(appTest);
}
</script>
...
```

When you open your version of [test-runner.html](http://scratch.pageforest.com/test-runner.html) you should see this output:

```
YOURAPPNAME Unit Tests


Test Suite: com.pageforest.YOURAPPNAME.test
===========================================
1. PASS [Scratch Unit Tests] 0 errors out of 1 tests
2. PASS [Function Coverage for 'com.pageforest.scratch'] 0 errors out of 0 tests
===========================================
Summary: All (2) tests pass.
```

The Test Runner will call the addTests function in your test module.  You can call
` ts.addTest ` to add individual test cases to your Test Suite.  The Test Runner also adds
a code coverage test at the end of your unit tests.  If your tests to not exercise
an export function or method, the coverage test will generate a testing error.

# addTest #

addTest(_testName_, _testFunction_)

  * _testName_ - String name for this test
  * _testFunction_(ut) - A function with a single argument - a UnitTest object.  Use the UnitTest to call ut.assert and other methods to test assumptions about your code.
  * _returns_ - A UnitTest object, so you can chain method calls to change attributes of the UnitTest before it is executed.

_Example_:

```
ts.addTest("Basic Test", function(ut) {
    ut.assertEq(1 + 1, 2);
});
```

# UnitTest #

The UnitTest (ut) object provides your test with methods to test assumptions about your
code.

| **Assert Method** | **Description** |
|:------------------|:----------------|
| ut.**assert**(_value_, _note1_, _note2_) | Tests that **value** is id **true**.  If not, an error is displayed in the test, along with the (optional) note strings. <br><br><i>Example</i>:<br><br><code>ut.assert(a == 7, "expected value is 7");</code> <br>
<tr><td> ut.<b>assertEq</b>(<i>value1</i>, <i>value2</i>, <i>note</i>) </td><td> Test for equality.<br><br><i>Example</i>:<br><br><code>ut.assertEq(1 + 1, 2, "Simple math");</code> </td></tr>
<tr><td> ut.<b>assertNEq</b>(<i>value1</i>, <i>value2</i>, <i>note</i>) </td><td> Test for inequality.<br><br><i>Example</i>:<br><br><code>ut.assertEq(1 + 1, 3, "Simple math");</code> </td></tr>
<tr><td> ut.<b>assertIdent</b>(<i>value1</i>, <i>value2</i>, <i>note</i>) </td><td> Test identical objects.<br><br><i>Example</i>:<br><br><code>ut.assertEq(obj1, obj2, "Objects are the same");</code> </td></tr>
<tr><td> ut.<b>assertGT</b>(<i>value1</i>, <i>value2</i>, <i>note</i>) </td><td> Test value1 greater than value2.<br><br><i>Example</i>:<br><br><code>ut.assertGT(a, 2);</code> </td></tr>
<tr><td> ut.<b>assertLT</b>(<i>value1</i>, <i>value2</i>, <i>note</i>) </td><td> Test value1 less than value2.<br><br><i>Example</i>:<br><br><code>ut.assertEq(a, 7);</code> </td></tr></tbody></table>

<i>For more examples see <a href='http://www.pageforest.com/static/src/js/tests/test-unit.js'>test-unit.js</a></i> (the results of which can be seen <a href='http://www.pageforest.com/static/src/js/tests/test-runner.html#unit'>here</a>).<br>
