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
        var oldLogger = ns.logger;
        ns.logger = logger;
        ns.log = logger.log.fnMethod(logger);
        return oldLogger;
    }

    // Usage: oldfunc.decorate(deprecated, "Don't use anymore.")
    function deprecated(fn, args, fnWrapper) {
        if (fn == undefined) {
            fnWrapper.deprecated = getFunctionName(this);
            if (args[1]) {
                fnWrapper.warning = ' - ' + args[1];
            }
            return;
        }

        ns.log("{0} is a deprecated function{1}".format(
            fnWrapper.deprecated || getFunctionName(fn),
            fnWrapper.warning),
            {level: 'info', once: true});
        return fn.apply(this, args);
    }

    // Usage: func.decorate(alias, aliasName, (opt) aliasFor)
    function alias(fn, args, fnWrapper) {
        if (fn == undefined)  {
            fnWrapper.aliasName = args[1];
            fnWrapper.preferred = args[2] || getFunctionName(this);
            return;
        }

        ns.log("{0} is deprecated - use {1} instead."
               .format(fnWrapper.aliasName, fnWrapper.preferred),
            {level: 'info', once: true});
        return fn.apply(this, args);
    }

    setLogger(new Logger());

    ns.extend({
        'getFunctionName': getFunctionName,
        'Logger': Logger,
        'setLogger': setLogger,
        'deprecated': deprecated,
        'alias': alias
    });
});
