//--------------------------------------------------------------------------
// Timer Functions
//--------------------------------------------------------------------------
namespace.lookup('org.startpad.timer').defineOnce(function(ns) {
    var util = namespace.util;
    var base = namespace.lookup('org.startpad.base');

ns.extend({
msNow: function()
    {
    return new Date().getTime();
    }
});

ns.Timer = function(ms, fnCallback)
{
    this.ms = ms;
    this.fnCallback = fnCallback;
    return this;
};

util.extendObject(ns.Timer.prototype, {
        fActive: false,
        fRepeat: false,
        fInCallback: false,
        fReschedule: false,

repeat: function(f)
{
        if (f === undefined)
                {
                f = true;
                }
        this.fRepeat = f;
        return this;
},

ping: function()
{
        // In case of race condition - don't call function if deactivated
        if (!this.fActive)
                {
                return;
                }

        // Eliminate re-entrancy - is this possible?
        if (this.fInCallback)
                {
                this.fReschedule = true;
                return;
                }

        this.fInCallback = true;
        try
                {
                this.fnCallback();
                }
        catch (e)
                {
                console.error("Error in timer callback: " + e.message + "(" + e.name + ")");
                }
        this.fInCallback = false;

        if (this.fActive && (this.fRepeat || this.fReschedule))
                {
                this.active(true);
                }
},

// Calling Active resets the timer so that next call to ping will be in this.ms milliseconds from NOW
active: function(fActive)
{
        if (fActive === undefined)
                {
                fActive = true;
                }
        this.fActive = fActive;
        this.fReschedule = false;

        if (this.iTimer)
                {
                window.clearTimeout(this.iTimer);
                this.iTimer = undefined;
                }

        if (fActive)
                {
                this.iTimer = window.setTimeout(this.ping.fnMethod(this), this.ms);
                }

        return this;
}
}); // ns.Timer.prototype

}); // startpad.timer
