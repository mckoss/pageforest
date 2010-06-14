//--------------------------------------------------------------------------
// Timer Functions
//
// setInterval has not been reliable in browsers in the past.  So these
// functions use setTimeout for higher accuracy and repeatability.
// It's not clear if this is now obsolete in modern browsers.
//--------------------------------------------------------------------------
namespace.lookup('org.startpad.timer').defineOnce(function(ns) {
    var util = namespace.util;
    var base = namespace.lookup('org.startpad.base');

    ns.extend({
        msNow: function() {
            return new Date().getTime();
        }
    });

    ns.Timer = function(ms, fnCallback) {
        this.ms = ms;
        this.fnCallback = fnCallback;
        return this;
    };

    util.extendObject(ns.Timer.prototype, {
        fActive: false,
        fRepeat: false,

        repeat: function(f) {
            if (f === undefined) {
                f = true;
            }
            this.fRepeat = f;
            return this;
        },

        ping: function() {
            // In case of race condition - don't call function if deactivated
            if (!this.fActive) {
                return;
            }
            this.fnCallback();
            if (this.fActive && this.fRepeat) {
                this.active(true);
            }
        },

        // Calling Active resets the timer so that next call to ping
        // will be in this.ms milliseconds from NOW
        active: function(fActive) {
            if (fActive === undefined) {
                fActive = true;
            }
            this.fActive = fActive;
            // If a current timer exists - remove it.
            if (this.iTimer) {
                clearTimeout(this.iTimer);
                this.iTimer = undefined;
            }
            if (fActive) {
                this.iTimer = setTimeout(this.ping.fnMethod(this), this.ms);
            }
            return this;
        }
    }); // ns.Timer.prototype
}); // startpad.timer
