namespace.lookup('com.pageforest.modules').defineOnce(function (ns) {
    var modules = {
        'org.startpad': ['namespace', 'base', 'unit', 'timer', 'vector',
                         'format', 'cookies'],
        'com.pageforest': ['client', 'sign-in', 'registration']
    };

    ns.testAttrs = {
        namespace: {noui: true},
        base: {noui: true},
        vector: {noui: true},
        format: {noui: true}
    };

    // Produce a file map of files, relative to tests directory where each
    // module can be found.  Key are namespaces like:
    // - org.startpad.base
    // - org.startpad.base.test
    ns.locations = {};

    // Map module basenames to full namespace names.
    ns.namespaces = {};
    for (var root in modules) {
        if (modules.hasOwnProperty(root)) {
            for (var i = 0; i < modules[root].length; i++) {
                var module = modules[root][i];
                var name = root + '.' +  module;
                ns.namespaces[module] = name;
                ns.locations[name] = '../' + module + '.js';
                ns.locations[name + '.test'] = 'test-' + module + '.js';
            }
        }
    }
});
