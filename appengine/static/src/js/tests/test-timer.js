namespace.lookup('org.startpad.timer.test').defineOnce(function(ns) {
    var util = namespace.util;
    var timer = namespace.lookup("org.startpad.timer");

    function Measure(iTest, ut, fnCallback) {
        this.iTest = iTest;
        this.ut = ut;
        this.fnCallback = fnCallback;
        return this;
    }

    util.extendObject(Measure.prototype, {
        start: function() {
            this.msTest = 20 * this.iTest;
            this.msStart = timer.msNow();
            this.tm = new timer.Timer(this.msTest,
                                      this.end.fnMethod(this)).active();
        },
        end: function() {
            var ms = timer.msNow() - this.msStart;
            console.log(this.iTest);
            this.ut.assert(ms > (this.msTest * 0.9) && ms < (this.msTest * 1.1),
                           "Timer accuracy " + ms + " vs. " +
                           this.msTest + " " +
                           Math.floor(ms / this.msTest * 100) + "%");
            if (--this.iTest > 0) {
                this.start();
            }
            else if (this.fnCallback) {
                this.fnCallback();
            }
        }
    });

    ns.addTests = function(ts) {
        ts.addTest("One Shot", function(ut) {
            var c = 0;

            function Test() {
                c++;
                ut.assert(c == 1, "Multiple calls to oneshot timer.");
                ut.async(false);
            }

            new timer.Timer(100, Test).active();
        }).async().expect(0, 1);

        ts.addTest("Sequential Accuracy", function(ut) {
            var m = new Measure(5, ut, function() {
                ut.async(false);
            });
            m.start();
        }).async(true).expect(0, 5);

        ts.addTest("Concurrent Accuracy", function(ut) {
            var fnCallback = function() {
                ut.async(false);
            };

            for (var i = 1; i <= 5; i++) {
                new Measure(i, ut, i == 5 ? fnCallback: undefined).start();
            }
        }).async().expect(0, 15);

        ts.addTest("Repeat", function(ut) {
            var c = 20;
            var tm;

            function Callback() {
                c--;
                ut.assert(c >= 0, "Called after timer canceled");
                if (c == 0) {
                    tm.active(false);
                    ut.async(false);
                }
            }
            tm = new timer.Timer(100, Callback).repeat().active();
        }).async().enable(true).expect(0, 20);

        ts.addTest("Restart Timer", function(ut) {
            var c = 0;
            var tm;

            function Start() {
                if (c == 0) {
                    tm.active();
                }
                c++;
                ut.assert(c <= 2, "Should just call twice");
            }

            function Eval() {
                ut.assertEq(c, 2);
                ut.async(false);
            }
            tm = new timer.Timer(100, Start).active();
            new timer.Timer(500, Eval).active();
        }).async().expect(0, 3);
    }; // addTests
});
