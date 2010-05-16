namespace.lookup('com.pageforest.modules').defineOnce(function (ns) {
    var modules = {
        'org.startpad': ['namespace', 'base', 'unit', 'timer', 'vector',
                         'format', 'cookies'],
        'com.pageforest': ['client', 'sign-in', 'registration']
    };

    // Produce a file map of files, relative to tests directory where each
    // module can be found.
    ns.locations = {};
    for (var root in modules) {
        if (modules.hasOwnProperty(root)) {
            for (var i = 0; i < modules[root].length; i++) {
                var module = modules[root][i];
                var name = root + '.' +  module;
                ns.locations[name] = '../' + module + '.js';
                ns.locations[name + '.test'] = 'test-' + module + '.js';
            }
        }
    }
});
