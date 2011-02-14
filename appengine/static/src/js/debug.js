namespace.lookup('org.startpad.debug').defineOnce(function(ns) {
    var util = namespace.util;

    var reFuncName = /^function\s+(\S+)\s*\(/;

    function getFunctionName(func) {
        if (typeof func != 'function') {
            return "notAFunction";
        }
        var result = reFuncName.exec(func.toString());
        if (result == null) {
            return "anonymous";
        }
        return result[1];
    }

    function Logger(active) {
        this.activate(active);
        this.logged = {};
    }

    Logger.methods({
        activate: function(f) {
            this.active = (f == undefined) ? true : f;
        },

        log: function(message, options) {

            if (!this.fLogging) {
                return;
            }
            if (options == undefined) {
                options = {};
            }
            if (!options.hasOwnProperty('level')) {
                options.level = 'log';
            }
            if (options.once) {
                if (this.logged[message]) {
                    return;
                }
                this.logged[message] = true;
            }

            if (options.hasOwnProperty('obj')) {
                console[options.level](message, options.obj);
            } else {
                console[options.level](message);
            }
        }
    });

    function setLogger(logger) {
        ns.logger = logger;
        ns.log = logger.log.fnMethod(logger);
    }

    // Usage: oldfunc.decorate(deprecated, "Don't use anymore.")
    function deprecated(fn, args, state) {
        ns.log("{0} is a deprecated function {1}".format(
            state.deprecated || getFunctionName(fn),
            state.info),
            {level: 'info', once: true});
        return fn.apply(this, args);
    }

    deprecated.init = function(args, state) {
        state.deprecated = getFunctionName(this);
        state.warning = args[1];
    };

    // Usage: func.decorate(alias, aliasName, (opt) aliasFor)
    function alias(fn, args, state) {
        ns.log("{0} is deprecated - use {1}, instead.".format(state.aliasName, state.preferred),
            {level: 'info', once: true});
        return fn.apply(this, args);
    }

    alias.init = function(args, state) {
        state.aliasName = args[1];
        state.preferred = args[2] || getFunctionName(this);
    };

    setLogger(new Logger());

    ns.extend({
        'getFunctionName': getFunctionName,
        'Logger': Logger,
        'setLogger': setLogger,
        'deprecated': deprecated,
        'alias': alias
    });
});
