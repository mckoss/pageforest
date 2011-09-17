/* Source: scripts/namespace-plus.js */
/* Source: src/namespace.js */
/* Namespace.js - modular namespaces in JavaScript

   by Mike Koss - placed in the public domain
*/

(function(global) {
    var globalNamespace = global['namespace'];
    var VERSION = '3.0.1';

    function Module() {}

    function numeric(s) {
        if (!s) {
            return 0;
        }
        var a = s.split('.');
        return 10000 * parseInt(a[0]) + 100 * parseInt(a[1]) + parseInt(a[2]);
    }

    if (globalNamespace) {
        if (numeric(VERSION) <= numeric(globalNamespace['VERSION'])) {
            return;
        }
        Module = globalNamespace.constructor;
    } else {
        global['namespace'] = globalNamespace = new Module();
    }
    globalNamespace['VERSION'] = VERSION;

    function require(path) {
        path = path.replace(/-/g, '_');
        var parts = path.split('.');
        var ns = globalNamespace;
        for (var i = 0; i < parts.length; i++) {
            if (ns[parts[i]] === undefined) {
                ns[parts[i]] = new Module();
            }
            ns = ns[parts[i]];
        }
        return ns;
    }

    var proto = Module.prototype;

    proto['module'] = function(path, closure) {
        var exports = require(path);
        if (closure) {
            closure(exports, require);
        }
        return exports;
    };

    proto['extend'] = function(exports) {
        for (var sym in exports) {
            if (exports.hasOwnProperty(sym)) {
                this[sym] = exports[sym];
            }
        }
    };
}(this));
/* Source: src/types.js */
namespace.module('org.startpad.types', function (exports, require) {
exports.extend({
    'VERSION': '0.2.2',
    'isArguments': function (value) { return isType(value, 'arguments'); },
    'isArray': function (value) { return isType(value, 'array'); },
    'copyArray': copyArray,
    'isType': isType,
    'typeOf': typeOf,
    'extend': extend,
    'project': project,
    'getFunctionName': getFunctionName,
    'keys': Object.keys || keys,
    'patch': patch
});

function patch() {
    Object.keys = Object.keys || keys;  // JavaScript 1.8.5
    return exports;
}

// Can be used to copy Arrays and Arguments into an Array
function copyArray(arg) {
    return Array.prototype.slice.call(arg);
}

var baseTypes = ['number', 'string', 'boolean', 'array', 'function', 'date',
                 'regexp', 'arguments', 'undefined', 'null'];

function internalType(value) {
    return Object.prototype.toString.call(value).match(/\[object (.*)\]/)[1].toLowerCase();
}

function isType(value, type) {
    return typeOf(value) == type;
}

// Return one of the baseTypes as a string
function typeOf(value) {
    if (value === undefined) {
        return 'undefined';
    }
    if (value === null) {
        return 'null';
    }
    var type = internalType(value);
    if (baseTypes.indexOf(type) == -1) {
        type = typeof(value);
    }
    return type;
}

// IE 8 has bug that does not enumerates even own properties that have
// these internal names.
var enumBug = !{toString: true}.propertyIsEnumerable('toString');
var internalNames = ['toString', 'toLocaleString', 'valueOf',
                     'constructor', 'isPrototypeOf'];

// Copy the (own) properties of all the arguments into the first one (in order).
function extend(dest) {
    var i, j;
    var source;
    var prop;

    if (dest === undefined) {
        dest = {};
    }
    for (i = 1; i < arguments.length; i++) {
        source = arguments[i];
        for (prop in source) {
            if (source.hasOwnProperty(prop)) {
                dest[prop] = source[prop];
            }
        }
        if (!enumBug) {
            continue;
        }
        for (j = 0; j < internalNames.length; j++) {
            prop = internalNames[j];
            if (source.hasOwnProperty(prop)) {
                dest[prop] = source[prop];
            }
        }
    }
    return dest;
}

// Return new object with just the listed properties "projected"
// into the new object.  Ignore undefined properties.
function project(obj, props) {
    var result = {};
    if (typeof props == 'string') {
        props = [props];
    }
    for (var i = 0; i < props.length; i++) {
        var name = props[i];
        if (obj && obj.hasOwnProperty(name)) {
            result[name] = obj[name];
        }
    }
    return result;
}

function getFunctionName(fn) {
    if (typeof fn != 'function') {
        return undefined;
    }
    var result = fn.toString().match(/function\s*(\S+)\s*\(/);
    if (!result) {
        return '';
    }
    return result[1];
}

function keys(obj) {
    var list = [];

    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            list.push(prop);
        }
    }
    return list;
}
});

/* Source: src/funcs.js */
namespace.module('org.startpad.funcs', function (exports, require) {
var types = require('org.startpad.types');

exports.extend({
    'VERSION': '0.3.1',
    'methods': methods,
    'bind': bind,
    'decorate': decorate,
    'create': Object.create || create,
    'subclass': subclass,
    'mro': mro,
    'numericVersion': numericVersion,
    'monkeyPatch': monkeyPatch,
    'patch': patch
});

// Convert 3-part version number to comparable integer.
// Note: No part should be > 99.
function numericVersion(s) {
    if (!s) {
        return 0;
    }
    var a = s.split('.');
    return 10000 * parseInt(a[0]) + 100 * parseInt(a[1]) + parseInt(a[2]);
}

// Monkey patch additional methods to constructor prototype, but only
// if patch version is newer than current patch version.
function monkeyPatch(ctor, by, version, patchMethods) {
    if (ctor._patches) {
        var patchVersion = ctor._patches[by];
        if (numericVersion(patchVersion) >= numericVersion(version)) {
            return;
        }
    }
    ctor._patches = ctor._patches || {};
    ctor._patches[by] = version;
    methods(ctor, patchMethods);
}

function patch() {
    if (!Object.create) {
        Object.create = create;
    }

    monkeyPatch(Function, 'org.startpad.funcs', exports.VERSION, {
        'methods': function (obj) { methods(this, obj); },
        'curry': function () {
            var args = [this, undefined].concat(types.copyArray(arguments));
            return bind.apply(undefined, args);
        },
        'curryThis': function (self) {
            var args = types.copyArray(arguments);
            args.unshift(this);
            return bind.apply(undefined, args);
        },
        'decorate': function (decorator) {
            return decorate(this, decorator);
        },
        'subclass': function(parent, extraMethods) {
            subclass(this, parent, extraMethods);
        },
        'mro': function(ctors, extraMethods) {
            ctors.unshift(this);
            mro(ctors, extraMethods);
        }
    });
    return exports;
}

// Copy methods to a Constructor Function's prototype
function methods(ctor, obj) {
    types.extend(ctor.prototype, obj);
}

// Bind 'this' and/or arguments and return new function.
// Differs from native bind (if present) in that undefined
// parameters are merged.
function bind(fn, self) {
    var presets;

    // Handle the monkey-patched and in-line forms of curry
    if (arguments.length == 3 && types.isArguments(arguments[2])) {
        presets = Array.prototype.slice.call(arguments[2], self1);
    } else {
        presets = Array.prototype.slice.call(arguments, 2);
    }

    function merge(a1, a2) {
        var merged = types.copyArray(a1);
        a2 = types.copyArray(a2);
        for (var i = 0; i < merged.length; i++) {
            if (merged[i] === undefined) {
                merged[i] = a2.shift();
            }
        }
        return merged.concat(a2);
    }

    return function curried() {
        return fn.apply(self || this, merge(presets, arguments));
    };
}

// Wrap the fn function with a generic decorator like:
//
// function decorator(fn, arguments, wrapper) {
//   if (fn == undefined) { ... init ...; return;}
//   ...
//   result = fn.apply(this, arguments);
//   ...
//   return result;
// }
//
// The decorated function is created for each call
// of the decorate function.  In addition to wrapping
// the decorated function, it can be used to save state
// information between calls by adding properties to it.
function decorate(fn, decorator) {
    function decorated() {
        return decorator.call(this, fn, arguments, decorated);
    }
    // Init call - pass undefined fn - but available in this
    // if needed.
    decorator.call(fn, undefined, arguments, decorated);
    return decorated;
}

// Create an empty object whose __proto__ points to the given object.
// It's properties will "shadow" those of the given object until modified.
function create(obj) {
    function Create() {}
    Create.prototype = obj;
    return new Create();
}

// Classical JavaScript single-inheritance pattern.
// Call super constructor via this._super(args);
// Call super methods via this._proto.method.call(this, args)
function subclass(ctor, parent, extraMethods) {
    ctor.prototype = exports.create(parent.prototype);
    ctor.prototype.constructor = ctor;
    methods(ctor, extraMethods);
    return ctor;
}

// Define method resolution order for multiple inheritance.
// Builds a custom prototype chain, where each constructor's
// prototype appears exactly once.
function mro(ctors, extraMethods) {
    var parent = ctors.pop().prototype;
    var ctor;
    while (ctors.length > 0) {
        ctor = ctors.pop();
        var ctorName = types.getFunctionName(ctor);
        var proto = exports.create(parent);
        types.extend(proto, ctor.prototype);
        proto.constructor = ctor;
        proto[ctorName + '_super'] = parent;
        parent = proto;
    }
    ctor.prototype = parent;
    methods(ctor, extraMethods);
}
});

/* Source: src/string.js */
namespace.module('org.startpad.string', function (exports, require) {
var funcs = require('org.startpad.funcs');

exports.extend({
    'VERSION': '0.3.0',
    'patch': patch,
    'format': format,
    'strip': strip
});

function patch() {
    funcs.monkeyPatch(String, 'org.startpad.string', exports.VERSION, {
        'format': function formatFunction () {
            if (arguments.length == 1 && typeof arguments[0] == 'object') {
                return format(this, arguments[0]);
            } else {
                return format(this, arguments);
            }
        }
    });
    return exports;
}

var reFormat = /\{\s*([^} ]+)\s*\}/g;

// Format a string using values from a dictionary or array.
// {n} - positional arg (0 based)
// {key} - object property (first match)
// .. same as {0.key}
// {key1.key2.key3} - nested properties of an object
// keys can be numbers (0-based index into an array) or
// property names.
function format(st, args, re) {
    re = re || reFormat;
    if (st == undefined) {
        return "undefined";
    }
    st = st.toString();
    st = st.replace(re, function(whole, key) {
        var value = args;
        var keys = key.split('.');
        for (var i = 0; i < keys.length; i++) {
            key = keys[i];
            var n = parseInt(key);
            if (!isNaN(n)) {
                value = value[n];
            } else {
                value = value[key];
            }
            if (value == undefined) {
                return "";
            }
        }
        // Implicit toString() on this.
        return value;
    });
    return st;
}

// Like Python strip() - remove leading/trailing space
function strip(s) {
    return (s || "").replace(/^\s+|\s+$/g, "");
}
});
/* Source: scripts/codemirror.js */
/*global CodeMirror */
namespace.module('com.pageforest.editor.codemirror', function(exports, require) {

    var codemirror;

    exports.extend({
        isProbablySupported: isProbablySupported,
        createEditor: createEditor,
        adjustHeight: adjustHeight,
        getData: getData,
        codemirror: codemirror
    });


    // Guess if the browser supports this editor.
    function isProbablySupported() {
        return CodeMirror.isProbablySupported() &&
            !navigator.userAgent.match(/^Mozilla.5.0 .iPad/);
    }

    // Create a CodeMirror and put it in the content div.
    function createEditor(filename, data) {
        var options = {
            path: '/codemirror/js/',
            width: '100%',
            height: '100px',
            content: data
        };
        var lower = filename.toLowerCase();
        if (lower.substr(-5) == '.html') {
            options.stylesheet = ['/codemirror/css/xmlcolors.css',
                                  '/codemirror/css/jscolors.css',
                                  '/codemirror/css/csscolors.css'];
            options.parserfile = ['parsexml.js',
                                  'parsecss.js',
                                  'tokenizejavascript.js',
                                  'parsejavascript.js',
                                  'parsehtmlmixed.js'];
            options.parser = 'HTMLMixedParser';
        } else if (lower.substr(-4) == '.xml') {
            options.stylesheet = '/codemirror/css/xmlcolors.css';
            options.parserfile = ['parsexml.js'];
            options.parser = 'XMLParser';
        } else if (lower.substr(-3) == '.js' ||
                   lower.substr(-5) == '.json') {
            options.stylesheet = '/codemirror/css/jscolors.css';
            options.parserfile = ['tokenizejavascript.js',
                                  'parsejavascript.js'];
            options.parser = 'JSParser';
        } else if (lower.substr(-4) == '.css') {
            options.stylesheet = '/codemirror/css/csscolors.css';
            options.parserfile = 'parsecss.js';
            options.parser = 'CSSParser';
        } else {
            options.parserfile = 'parsedummy.js';
            options.parser = 'DummyParser';
        }
        var code = $('<textarea id="code"></textarea>');
        $('#content').empty().append(code);
        codemirror = window.CodeMirror.fromTextArea("code", options);
        // codemirror.focus();
    }

    // Make the CodeMirror shorter or longer, after a new file is loaded.
    function adjustHeight(shrink) {
        if (!codemirror || !codemirror.editor) {
            return;
        }
        var body = codemirror.editor.container;
        var scrollHeight = body.scrollHeight;
        // var offsetHeight = body.offsetHeight;
        // console.log(body, scrollHeight, offsetHeight);
        var wrapping = $('.CodeMirror-wrapping');
        wrapping.css('height', scrollHeight + 'px');
    }

    // Get the edited file content from the editor.
    function getData() {
        return codemirror.getCode();
    }

});
/* Source: scripts/main.js */
namespace.module('com.pageforest.editor', function(exports, require) {
    var ns = {};
/*    var appListing,
        listing,
        app_id,
        filename = '',
        editor,
        hash,
        client;*/

    // Exported functions and variables
    exports.extend({
        onReady: onReady,
        onSave: onSave,
        onUserChange: onUserChange,
        onSignInOut: onSignInOut,
        appListing: ns.appListing,
        listing: ns.listing,
        app_id: ns.app_id,
        filename: ns.filename,
        editor: ns.editor,
        hash: ns.hash,
        client: ns.client
    });

    function keys(obj) {
        var result = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                result.push(key);
            }
        }
        return result;
    }

    function showStatus(message) {
        $('#status').text(message);
    }

    function onError(xhr, status, message) {
        showStatus(xhr.status + ' ' + xhr.statusText);
    }

    function getAppIcon(app_id) {
        if (ns.appListing[app_id].icon) {
            return '<img width="64" height="64" ' +
                'src="/mirror/' + app_id + '/' +
                ns.appListing[app_id].icon + '" alt="" />';
        } else {
            return '<img width="83" height="64" ' +
                'src="/icons/64/folder.png" alt="" />';
        }
    }

    function getIcon(filename) {
        if (filename.substr(-1) == '/') {
            return '<img width="83" height="64" ' +
                'src="/icons/64/folder.png" alt="" />';
        }
        if (filename.substr(-4) == '.png') {
            return '<img height="64" ' +
                'src="/mirror/' + filename + '" alt="" />';
        }
        var ext = 'txt';
        var dot = filename.lastIndexOf('.');
        if (dot > 0) {
            ext = filename.substr(dot + 1).toLowerCase();
            if (ext == 'json') {
                ext = 'js';
            }
        }
        return '<img width="54" height="64" ' +
            'src="/icons/64/' + ext + '.png" alt="" />';
    }

    function getFoldersAndFiles(path) {
        // Remove trailing slash.
        if (path.substr(-1) == '/') {
            path = path.substr(0, path.length - 1);
        }
        var pathLength = path.length || -1;
        var result = [];
        for (var filepath in ns.listing) {
            if (ns.listing.hasOwnProperty(filepath) &&
                (path == '' ||
                 (filepath.charAt(pathLength) == '/' &&
                  filepath.substr(0, path.length) == path))) {
                var parts = filepath.substr(pathLength + 1).split('/');
                if (parts.length == 1) {
                    result.push(parts[0]);
                } else {
                    var folder = parts[0] + '/';
                    if (result.indexOf(folder) == -1) {
                        result.push(folder);
                    }
                }
            }
        }
        return result;
    }

    function updateBreadcrumbs() {
        var html = [];
        html.push('<a href="#">apps</a>');
        html.push('<span class="quiet">/</span>');
        if (ns.app_id) {
            html.push('<a href="#' + ns.app_id + '">' + ns.app_id + '</a>');
            html.push('<span class="quiet">/</span>');
            var href = '#' + ns.app_id + '/';
            var parts = ns.filename.split('/');
            for (var i = 0; parts[i]; i++) {
                var part = parts[i];
                href += part;
                if (i < parts.length - 1) {
                    href += '/';
                }
                html.push('<a href="' + href + '">' + part + '</a>');
                if (href.substr(-1) == '/') {
                    html.push('<span class="quiet">/</span>');
                }
            }
        }
        $('#breadcrumbs').html(html.join('\n'));
    }

    function showApps() {
        ns.editor.view('hide');
        var html = [];
        for (var name in ns.appListing) {
            if (ns.appListing.hasOwnProperty(name)) {
                var icon = getAppIcon(name);
                html.push('<div class="icon">');
                html.push('<a href="#' + name + '">' + icon + '</a><br />');
                html.push('<a href="#' + name + '">' + name + '</a>');
                html.push('</div>');
            }
        }
        $('#content').html(html.join('\n'));
        showStatus("Loaded app list");
    }

    function showFiles() {
        updateBreadcrumbs();
        ns.editor.view('hide');
        var path = ns.filename;
        // Remove trailing slash.
        if (path.substr(-1) == '/') {
            path = path.substr(0, path.length - 1);
        }
        console.log('showFiles: ' + ns.listing + ' ' + path);
        var html = [];
        var filenames = getFoldersAndFiles(path);
        for (var i = 0; i < filenames.length; i++) {
            var filename = filenames[i];
            var href = ns.app_id + '/' + (path ? path + '/' : '') + filename;
            var icon = getIcon(href);
            html.push('<div class="icon">');
            html.push('<a href="#' + href + '">' + icon + '</a><br />');
            html.push('<a href="#' + href + '">' + filename + '</a>');
            html.push('</div>');
        }
        var iframe_src = '/mirror/' + ns.app_id + '/post?path=' + path;
        html.push('<div style="width:100%; height:10em; clear:both">');
        html.push('<iframe class="upload" src="' + iframe_src + '"' +
                  ' style="width:100%; height:100%; border:none"></iframe>');
        html.push('</div>');
        $('#content').html(html.join('\n'));
        showStatus("Loaded directory: " + ns.app_id + '/' + path);
    }

    function loadAppList() {
        ns.app_id = '';
        console.log('loadAppList');
        $.ajax({
            url: '/mirror?method=list',
            dataType: 'json',
            success: function(message) {
                updateBreadcrumbs();
                ns.appListing = message.items;
                if (!ns.app_id) {
                    showApps();
                }
            },
            error: function(xhr, status, message) {
                if (xhr.status == 403) {
                    $('#content').empty();
                    $('#status').html('<span class="error">' +
                                      "Please sign in to edit your apps." +
                                      '</span>');
                } else {
                    onError(xhr, status, message);
                }
            }
        });
    }

    function loadApp(app_id) {
        ns.app_id = app_id;
        $.ajax({
            url: '/mirror/' + ns.app_id + '?method=list&depth=0',
            dataType: 'json',
            error: onError,
            success: function(message) {
                updateBreadcrumbs();
                ns.listing = message.items;
                if (!ns.filename || ns.filename.substr(-1) == '/') {
                    showFiles();
                }
            }
        });
    }

    function loadFile(filename) {
        ns.filename = filename;
        if (filename == '' || filename.substr(-1) == '/') {
            showFiles();
        } else {
            $.ajax({
                url: '/mirror/' + ns.app_id + '/' + ns.filename,
                dataType: 'text',
                error: onError,
                success: function(message) {
                    updateBreadcrumbs();
                    $('#content').empty();
                    ns.editor.loadFile(ns.filename, message);
                    ns.editor.adjustHeight('shrink');
                    ns.editor.view('show');
                    showStatus("Loaded file: " + ns.filename);
                }
            });
        }
    }

    // Parse and process the result from a POST request.
    function checkIFrame() {
        var iframe = $('iframe.upload')[0];
        if (iframe) {
            var data = iframe.contentWindow.document.body.innerHTML;
            // Strip HTML tags like <pre> out of the data.
            var stripped = data.replace(/<\/?[^>]+>\s*/gi, '');
            if (stripped.substr(0, 1) == '{') {
                var parsed = JSON.parse(stripped);
                if (parsed.status == 200) {
                    // Upload successful, reload app listing and folder view.
                    loadApp(ns.app_id);
                }
            }
        }
    }

    function checkHash() {
        var hash = window.location.hash;
        if (hash == ns.hash) {
            ns.editor.adjustHeight();
            return;
        }
        ns.hash = hash;
        // Split hash into app_id and filename.
        var parts = hash.substr(1).split('/');
        console.log('parts: [' + parts + ']');
        var app_id = parts.shift();
        var filename = parts.join('/');
        console.log('app_id: [' + app_id + ']');
        if (!app_id) {
            loadAppList();
        } else if (app_id != ns.app_id) {
            loadApp(app_id);
            if (filename) {
                loadFile(filename);
            } else {
                ns.filename = '';
            }
        } else if (filename != ns.filename) {
            loadFile(filename);
        }
    }

    function guessEditor() {
        // in limbo, just defaults to one or the other
        console.log('User-Agent: ' + navigator.userAgent);
        var requireTextarea = true;
        if (requireTextarea) {
            $('#editor').val('textarea');
            return ns.textarea;
        }
        $('#editor').val('ace');
        return ns.ace;
    }

    function setEditor() {
        console.log('setEditor()');
        if (!ns.editor.view()) {
            ns.editor = ns[$('#editor').val()];
            return;
        }
        var data = ns.editor.getData();
        ns.editor.view('hide');
        ns.editor = ns[$('#editor').val()];
        ns.editor.loadFile(ns.filename, data);
        ns.editor.view('show');
    }

    function onReady() {
        var clientLib = namespace.lookup('com.pageforest.client');
        ns.client = new clientLib.Client(exports);
        ns.client.saveInterval = 0;  // Turn off auto-save.
        ns.client.state = 'clean';   // Turn off beforeUnload.
        ns.hash = '###';  // Not initialized, wait for checkHash to update.
        ns.app_id = '';
        ns.filename = '';
        // Start polling for window.location.hash changes and iframe.
        setInterval(checkHash, 200);
        setInterval(checkIFrame, 1000);
        // get textarea and ace namespaces
        ns.ace = namespace.lookup('com.pageforest.editor.ace');
        ns.ace.createEditor();
        ns.ace.view('hide');
        ns.textarea = namespace.lookup('com.pageforest.editor.textarea');
        ns.textarea.view('hide');
        ns.editor = guessEditor();

        $(window).bind('resize', onResize);
        $('#editor').change(setEditor);
    }

    function onResize() {
        $('#ace').css('height', window.innerHeight - 43 + 'px');
        $('#ace').css('width', window.innerWidth + 'px');
        $('#textarea').css('height', window.innerHeight - 43 + 'px');
        $('#textarea').css('width', window.innerWidth + 'px');
    }

    function onSave() {
        $.ajax({
            type: 'PUT',
            url: '/mirror/' + ns.app_id + '/' + ns.filename,
            data: ns.editor.getData(),
            dataType: 'text',
            success: function(message, status, xhr) {
                showStatus(message);
            },
            error: onError
        });
    }

    // Called when the current user has changed (signed in or out)
    function onUserChange(username) {
        console.log('onUserChange(' + username + ');');
        if (username == undefined) {
            $('#username').text('anonymous');
            $('#signin').text('Sign in')
                .attr('href', 'http://www.pageforest.com/sign-in/editor');
        } else {
            $('#username').text(username);
            $('#signin').text('Sign out')
                .attr('href', 'http://www.pageforest.com/sign-out/editor');
        }
        if (!ns.app_id) {
            loadAppList();
        }
    }

    // Sign in (or out) depending on current user state.
    function onSignInOut() {
        var isSignedIn = ns.client.username != undefined;
        if (isSignedIn) {
            ns.client.signOut();
        } else {
            ns.client.signIn();
        }
    }

});
/* Source: scripts/textarea.js */
namespace.module('com.pageforest.editor.textarea', function(exports, require) {

    var visible = false;

    exports.extend({
        createEditor: createEditor,
        loadFile: loadFile,
        adjustHeight: adjustHeight,
        getData: getData,
        view: view
    });

    // hides/shows/returns if visible
    function view(action) {
        if (action == 'show') {
            visible = true;
            $('#textarea').css('visibility', 'visible');
            return true;
        } else if (action == 'hide') {
            visible = false;
            $('#textarea').css('visibility', 'hidden');
            return false;
        } else {
            return visible;
        }
    }

    // Create a textarea and put it in the content div.
    function createEditor() {
        return;
    }

    function loadFile(filename, data) {
//        $('#textarea').css('height', window.innerHeight - 43 + 'px');
//        $('#textarea').css('width', window.innerWidth + 'px');
        var code = $('<textarea id="code"></textarea>');
        $('#textarea').empty().append(code);
        code.val(data).focus();
    }

    // Make the textarea shorter or longer, after a new file is loaded.
    function adjustHeight(shrink) {
        console.log('adjustHeight() within textarea');
        var editor = $('#code');
        var scrollHeight = editor.attr('scrollHeight');
        var offsetHeight = editor.attr('offsetHeight');
        while (shrink && offsetHeight && scrollHeight == offsetHeight) {
            editor.css('height', (offsetHeight / 2) + 'px');
            scrollHeight = editor.attr('scrollHeight');
            offsetHeight = editor.attr('offsetHeight');
        }
        if (scrollHeight > offsetHeight) {
            editor.css('height', scrollHeight + 'px');
        }
    }

    // Get the edited file content from the textarea.
    function getData() {
        return $('textarea').val();
    }

});
/* Source: ace/mode-javascript.js */
define("ace/mode/javascript",["require","exports","module","pilot/oop","ace/mode/text","ace/tokenizer","ace/mode/javascript_highlight_rules","ace/mode/matching_brace_outdent","ace/range","ace/worker/worker_client","ace/mode/behaviour/cstyle"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/text").Mode,f=a("ace/tokenizer").Tokenizer,g=a("ace/mode/javascript_highlight_rules").JavaScriptHighlightRules,h=a("ace/mode/matching_brace_outdent").MatchingBraceOutdent,i=a("ace/range").Range,j=a("ace/worker/worker_client").WorkerClient,k=a("ace/mode/behaviour/cstyle").CstyleBehaviour,l=function(){this.$tokenizer=new f((new g).getRules()),this.$outdent=new h,this.$behaviour=new k};d.inherits(l,e),function(){this.toggleCommentLines=function(a,b,c,d){var e=!0,f=[],g=/^(\s*)\/\//;for(var h=c;h<=d;h++)if(!g.test(b.getLine(h))){e=!1;break}if(e){var j=new i(0,0,0,0);for(var h=c;h<=d;h++){var k=b.getLine(h),l=k.match(g);j.start.row=h,j.end.row=h,j.end.column=l[0].length,b.replace(j,l[1])}}else b.indentRows(c,d,"//")},this.getNextLineIndent=function(a,b,c){var d=this.$getIndent(b),e=this.$tokenizer.getLineTokens(b,a),f=e.tokens,g=e.state;if(f.length&&f[f.length-1].type=="comment")return d;if(a=="start"||a=="regex_allowed"){var h=b.match(/^.*[\{\(\[\:]\s*$/);h&&(d+=c)}else if(a=="doc-start"){if(g=="start"||a=="regex_allowed")return"";var h=b.match(/^\s*(\/?)\*/);h&&(h[1]&&(d+=" "),d+="* ")}return d},this.checkOutdent=function(a,b,c){return this.$outdent.checkOutdent(b,c)},this.autoOutdent=function(a,b,c){this.$outdent.autoOutdent(b,c)},this.createWorker=function(a){var b=a.getDocument(),c=new j(["ace","pilot"],"worker-javascript.js","ace/mode/javascript_worker","JavaScriptWorker");return c.call("setValue",[b.getValue()]),b.on("change",function(a){a.range={start:a.data.range.start,end:a.data.range.end},c.emit("change",a)}),c.on("jslint",function(b){var c=[];for(var d=0;d<b.data.length;d++){var e=b.data[d];e&&c.push({row:e.line-1,column:e.character-1,text:e.reason,type:"warning",lint:e})}a.setAnnotations(c)}),c.on("narcissus",function(b){a.setAnnotations([b.data])}),c.on("terminate",function(){a.clearAnnotations()}),c}}.call(l.prototype),b.Mode=l}),define("ace/mode/javascript_highlight_rules",["require","exports","module","pilot/oop","pilot/lang","ace/unicode","ace/mode/doc_comment_highlight_rules","ace/mode/text_highlight_rules"],function(a,b,c){var d=a("pilot/oop"),e=a("pilot/lang"),f=a("ace/unicode"),g=a("ace/mode/doc_comment_highlight_rules").DocCommentHighlightRules,h=a("ace/mode/text_highlight_rules").TextHighlightRules,i=function(){var a=e.arrayToMap("break|case|catch|continue|default|delete|do|else|finally|for|function|if|in|instanceof|new|return|switch|throw|try|typeof|let|var|while|with|const|yield|import|get|set".split("|")),b="case|do|else|finally|in|instanceof|return|throw|try|typeof|yield",c=e.arrayToMap("null|Infinity|NaN|undefined".split("|")),d=e.arrayToMap("class|enum|extends|super|export|implements|private|public|interface|package|protected|static".split("|")),h="["+f.packages.L+"\\$_]["+f.packages.L+f.packages.Mn+f.packages.Mc+f.packages.Nd+f.packages.Pc+"\\$_]*\\b";this.$rules={start:[{token:"comment",regex:"\\/\\/.*$"},(new g).getStartRule("doc-start"),{token:"comment",merge:!0,regex:"\\/\\*",next:"comment"},{token:"string",regex:'["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'},{token:"string",merge:!0,regex:'["].*\\\\$',next:"qqstring"},{token:"string",regex:"['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"},{token:"string",merge:!0,regex:"['].*\\\\$",next:"qstring"},{token:"constant.numeric",regex:"0[xX][0-9a-fA-F]+\\b"},{token:"constant.numeric",regex:"[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"},{token:["keyword","text","entity.name.function"],regex:"(function)(\\s+)("+h+")"},{token:"constant.language.boolean",regex:"(?:true|false)\\b"},{token:"keyword",regex:"(?:"+b+")\\b",next:"regex_allowed"},{token:function(b){return b=="this"?"variable.language":a.hasOwnProperty(b)?"keyword":c.hasOwnProperty(b)?"constant.language":d.hasOwnProperty(b)?"invalid.illegal":b=="debugger"?"invalid.deprecated":"identifier"},regex:h},{token:"keyword.operator",regex:"!|\\$|%|&|\\*|\\-\\-|\\-|\\+\\+|\\+|~|===|==|=|!=|!==|<=|>=|<<=|>>=|>>>=|<>|<|>|!|&&|\\|\\||\\?\\:|\\*=|%=|\\+=|\\-=|&=|\\^=|\\b(?:in|instanceof|new|delete|typeof|void)",next:"regex_allowed"},{token:"lparen",regex:"[[({]",next:"regex_allowed"},{token:"rparen",regex:"[\\])}]"},{token:"keyword.operator",regex:"\\/=?",next:"regex_allowed"},{token:"comment",regex:"^#!.*$"},{token:"text",regex:"\\s+"}],regex_allowed:[{token:"comment",regex:"\\/\\/.*$"},{token:"string.regexp",regex:"\\/(?:(?:\\[(?:\\\\]|[^\\]])+\\])|(?:\\\\/|[^\\]/]))*[/]\\w*",next:"start"},{token:"text",regex:"\\s+"},{token:"empty",regex:"",next:"start"}],comment:[{token:"comment",regex:".*?\\*\\/",next:"start"},{token:"comment",merge:!0,regex:".+"}],qqstring:[{token:"string",regex:'(?:(?:\\\\.)|(?:[^"\\\\]))*?"',next:"start"},{token:"string",merge:!0,regex:".+"}],qstring:[{token:"string",regex:"(?:(?:\\\\.)|(?:[^'\\\\]))*?'",next:"start"},{token:"string",merge:!0,regex:".+"}]},this.embedRules(g,"doc-",[(new g).getEndRule("start")])};d.inherits(i,h),b.JavaScriptHighlightRules=i}),define("ace/mode/doc_comment_highlight_rules",["require","exports","module","pilot/oop","ace/mode/text_highlight_rules"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/text_highlight_rules").TextHighlightRules,f=function(){this.$rules={start:[{token:"comment.doc.tag",regex:"@[\\w\\d_]+"},{token:"comment.doc",merge:!0,regex:"\\s+"},{token:"comment.doc",merge:!0,regex:"TODO"},{token:"comment.doc",merge:!0,regex:"[^@\\*]+"},{token:"comment.doc",merge:!0,regex:"."}]}};d.inherits(f,e),function(){this.getStartRule=function(a){return{token:"comment.doc",merge:!0,regex:"\\/\\*(?=\\*)",next:a}},this.getEndRule=function(a){return{token:"comment.doc",merge:!0,regex:"\\*\\/",next:a}}}.call(f.prototype),b.DocCommentHighlightRules=f}),define("ace/mode/matching_brace_outdent",["require","exports","module","ace/range"],function(a,b,c){var d=a("ace/range").Range,e=function(){};(function(){this.checkOutdent=function(a,b){return/^\s+$/.test(a)?/^\s*\}/.test(b):!1},this.autoOutdent=function(a,b){var c=a.getLine(b),e=c.match(/^(\s*\})/);if(!e)return 0;var f=e[1].length,g=a.findMatchingBracket({row:b,column:f});if(!g||g.row==b)return 0;var h=this.$getIndent(a.getLine(g.row));a.replace(new d(b,0,b,f-1),h)},this.$getIndent=function(a){var b=a.match(/^(\s+)/);return b?b[1]:""}}).call(e.prototype),b.MatchingBraceOutdent=e}),define("ace/worker/worker_client",["require","exports","module","pilot/oop","pilot/event_emitter"],function(a,b,c){var d=a("pilot/oop"),e=a("pilot/event_emitter").EventEmitter,f=function(b,c,d,e){this.callbacks=[];if(a.packaged)var f=this.$guessBasePath(),g=this.$worker=new Worker(f+c);else{var h=this.$normalizePath(a.nameToUrl("ace/worker/worker",null,"_")),g=this.$worker=new Worker(h),i={};for(var j=0;j<b.length;j++){var k=b[j],l=this.$normalizePath(a.nameToUrl(k,null,"_").replace(/.js$/,""));i[k]=l}}this.$worker.postMessage({init:!0,tlns:i,module:d,classname:e}),this.callbackId=1,this.callbacks={};var m=this;this.$worker.onerror=function(a){throw window.console&&console.log&&console.log(a),a},this.$worker.onmessage=function(a){var b=a.data;switch(b.type){case"log":window.console&&console.log&&console.log(b.data);break;case"event":m._dispatchEvent(b.name,{data:b.data});break;case"call":var c=m.callbacks[b.id];c&&(c(b.data),delete m.callbacks[b.id])}}};(function(){d.implement(this,e),this.$normalizePath=function(a){return a.match(/^\w+:/)||(a=location.protocol+"//"+location.host+(a.charAt(0)=="/"?"":location.pathname.replace(/\/[^\/]*$/,""))+"/"+a.replace(/^[\/]+/,"")),a},this.$guessBasePath=function(){if(a.aceBaseUrl)return a.aceBaseUrl;var b=document.getElementsByTagName("script");for(var c=0;c<b.length;c++){var d=b[c],e=d.getAttribute("data-ace-base");if(e)return e.replace(/\/*$/,"/");var f=d.src||d.getAttribute("src");if(!f)continue;var g=f.match(/^(?:(.*\/)ace\.js|(.*\/)ace-uncompressed\.js)(?:\?|$)/);if(g)return g[1]||g[2]}return""},this.terminate=function(){this._dispatchEvent("terminate",{}),this.$worker.terminate()},this.send=function(a,b){this.$worker.postMessage({command:a,args:b})},this.call=function(a,b,c){if(c){var d=this.callbackId++;this.callbacks[d]=c,b.push(d)}this.send(a,b)},this.emit=function(a,b){this.$worker.postMessage({event:a,data:b})}}).call(f.prototype),b.WorkerClient=f}),define("ace/mode/behaviour/cstyle",["require","exports","module","pilot/oop","ace/mode/behaviour"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/behaviour").Behaviour,f=function(){this.add("braces","insertion",function(a,b,c,d,e){if(e=="{"){var f=c.getSelectionRange(),g=d.doc.getTextRange(f);return g!==""?{text:"{"+g+"}",selection:!1}:{text:"{}",selection:[1,1]}}if(e=="}"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column,h.column+1);if(j=="}"){var k=d.$findOpeningBracket("}",{column:h.column+1,row:h.row});if(k!==null)return{text:"",selection:[1,1]}}}else if(e=="\n"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column,h.column+1);if(j=="}"){var l=d.findMatchingBracket({row:h.row,column:h.column+1});if(!l)return!1;var m=this.getNextLineIndent(a,i.substring(0,i.length-1),d.getTabString()),n=this.$getIndent(d.doc.getLine(l.row));return{text:"\n"+m+"\n"+n,selection:[1,m.length,1,m.length]}}}return!1}),this.add("braces","deletion",function(a,b,c,d,e){var f=d.doc.getTextRange(e);if(!e.isMultiLine()&&f=="{"){var g=d.doc.getLine(e.start.row),h=g.substring(e.end.column,e.end.column+1);if(h=="}")return e.end.column++,e}return!1}),this.add("parens","insertion",function(a,b,c,d,e){if(e=="("){var f=c.getSelectionRange(),g=d.doc.getTextRange(f);return g!==""?{text:"("+g+")",selection:!1}:{text:"()",selection:[1,1]}}if(e==")"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column,h.column+1);if(j==")"){var k=d.$findOpeningBracket(")",{column:h.column+1,row:h.row});if(k!==null)return{text:"",selection:[1,1]}}}return!1}),this.add("parens","deletion",function(a,b,c,d,e){var f=d.doc.getTextRange(e);if(!e.isMultiLine()&&f=="("){var g=d.doc.getLine(e.start.row),h=g.substring(e.start.column+1,e.start.column+2);if(h==")")return e.end.column++,e}return!1}),this.add("string_dquotes","insertion",function(a,b,c,d,e){if(e=='"'){var f=c.getSelectionRange(),g=d.doc.getTextRange(f);if(g!=="")return{text:'"'+g+'"',selection:!1};var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column-1,h.column);if(j=="\\")return!1;var k=d.getTokens(f.start.row,f.start.row)[0].tokens,l=0,m,n=-1;for(var o=0;o<k.length;o++){m=k[o],m.type=="string"?n=-1:n<0&&(n=m.value.indexOf('"'));if(m.value.length+l>f.start.column)break;l+=k[o].value.length}if(!m||n<0&&m.type!=="comment"&&(m.type!=="string"||f.start.column!==m.value.length+l-1&&m.value.lastIndexOf('"')===m.value.length-1))return{text:'""',selection:[1,1]};if(m&&m.type==="string"){var p=i.substring(h.column,h.column+1);if(p=='"')return{text:"",selection:[1,1]}}}return!1}),this.add("string_dquotes","deletion",function(a,b,c,d,e){var f=d.doc.getTextRange(e);if(!e.isMultiLine()&&f=='"'){var g=d.doc.getLine(e.start.row),h=g.substring(e.start.column+1,e.start.column+2);if(h=='"')return e.end.column++,e}return!1})};d.inherits(f,e),b.CstyleBehaviour=f})
/* Source: ace/mode-html.js */
define("ace/mode/html",["require","exports","module","pilot/oop","ace/mode/text","ace/mode/javascript","ace/mode/css","ace/tokenizer","ace/mode/html_highlight_rules","ace/mode/behaviour/xml"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/text").Mode,f=a("ace/mode/javascript").Mode,g=a("ace/mode/css").Mode,h=a("ace/tokenizer").Tokenizer,i=a("ace/mode/html_highlight_rules").HtmlHighlightRules,j=a("ace/mode/behaviour/xml").XmlBehaviour,k=function(){var a=new i;this.$tokenizer=new h(a.getRules()),this.$behaviour=new j,this.$embeds=a.getEmbeds(),this.createModeDelegates({"js-":f,"css-":g})};d.inherits(k,e),function(){this.toggleCommentLines=function(a,b,c,d){return 0},this.getNextLineIndent=function(a,b,c){return this.$getIndent(b)},this.checkOutdent=function(a,b,c){return!1}}.call(k.prototype),b.Mode=k}),define("ace/mode/javascript",["require","exports","module","pilot/oop","ace/mode/text","ace/tokenizer","ace/mode/javascript_highlight_rules","ace/mode/matching_brace_outdent","ace/range","ace/worker/worker_client","ace/mode/behaviour/cstyle"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/text").Mode,f=a("ace/tokenizer").Tokenizer,g=a("ace/mode/javascript_highlight_rules").JavaScriptHighlightRules,h=a("ace/mode/matching_brace_outdent").MatchingBraceOutdent,i=a("ace/range").Range,j=a("ace/worker/worker_client").WorkerClient,k=a("ace/mode/behaviour/cstyle").CstyleBehaviour,l=function(){this.$tokenizer=new f((new g).getRules()),this.$outdent=new h,this.$behaviour=new k};d.inherits(l,e),function(){this.toggleCommentLines=function(a,b,c,d){var e=!0,f=[],g=/^(\s*)\/\//;for(var h=c;h<=d;h++)if(!g.test(b.getLine(h))){e=!1;break}if(e){var j=new i(0,0,0,0);for(var h=c;h<=d;h++){var k=b.getLine(h),l=k.match(g);j.start.row=h,j.end.row=h,j.end.column=l[0].length,b.replace(j,l[1])}}else b.indentRows(c,d,"//")},this.getNextLineIndent=function(a,b,c){var d=this.$getIndent(b),e=this.$tokenizer.getLineTokens(b,a),f=e.tokens,g=e.state;if(f.length&&f[f.length-1].type=="comment")return d;if(a=="start"||a=="regex_allowed"){var h=b.match(/^.*[\{\(\[\:]\s*$/);h&&(d+=c)}else if(a=="doc-start"){if(g=="start"||a=="regex_allowed")return"";var h=b.match(/^\s*(\/?)\*/);h&&(h[1]&&(d+=" "),d+="* ")}return d},this.checkOutdent=function(a,b,c){return this.$outdent.checkOutdent(b,c)},this.autoOutdent=function(a,b,c){this.$outdent.autoOutdent(b,c)},this.createWorker=function(a){var b=a.getDocument(),c=new j(["ace","pilot"],"worker-javascript.js","ace/mode/javascript_worker","JavaScriptWorker");return c.call("setValue",[b.getValue()]),b.on("change",function(a){a.range={start:a.data.range.start,end:a.data.range.end},c.emit("change",a)}),c.on("jslint",function(b){var c=[];for(var d=0;d<b.data.length;d++){var e=b.data[d];e&&c.push({row:e.line-1,column:e.character-1,text:e.reason,type:"warning",lint:e})}a.setAnnotations(c)}),c.on("narcissus",function(b){a.setAnnotations([b.data])}),c.on("terminate",function(){a.clearAnnotations()}),c}}.call(l.prototype),b.Mode=l}),define("ace/mode/javascript_highlight_rules",["require","exports","module","pilot/oop","pilot/lang","ace/unicode","ace/mode/doc_comment_highlight_rules","ace/mode/text_highlight_rules"],function(a,b,c){var d=a("pilot/oop"),e=a("pilot/lang"),f=a("ace/unicode"),g=a("ace/mode/doc_comment_highlight_rules").DocCommentHighlightRules,h=a("ace/mode/text_highlight_rules").TextHighlightRules,i=function(){var a=e.arrayToMap("break|case|catch|continue|default|delete|do|else|finally|for|function|if|in|instanceof|new|return|switch|throw|try|typeof|let|var|while|with|const|yield|import|get|set".split("|")),b="case|do|else|finally|in|instanceof|return|throw|try|typeof|yield",c=e.arrayToMap("null|Infinity|NaN|undefined".split("|")),d=e.arrayToMap("class|enum|extends|super|export|implements|private|public|interface|package|protected|static".split("|")),h="["+f.packages.L+"\\$_]["+f.packages.L+f.packages.Mn+f.packages.Mc+f.packages.Nd+f.packages.Pc+"\\$_]*\\b";this.$rules={start:[{token:"comment",regex:"\\/\\/.*$"},(new g).getStartRule("doc-start"),{token:"comment",merge:!0,regex:"\\/\\*",next:"comment"},{token:"string",regex:'["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'},{token:"string",merge:!0,regex:'["].*\\\\$',next:"qqstring"},{token:"string",regex:"['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"},{token:"string",merge:!0,regex:"['].*\\\\$",next:"qstring"},{token:"constant.numeric",regex:"0[xX][0-9a-fA-F]+\\b"},{token:"constant.numeric",regex:"[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"},{token:["keyword","text","entity.name.function"],regex:"(function)(\\s+)("+h+")"},{token:"constant.language.boolean",regex:"(?:true|false)\\b"},{token:"keyword",regex:"(?:"+b+")\\b",next:"regex_allowed"},{token:function(b){return b=="this"?"variable.language":a.hasOwnProperty(b)?"keyword":c.hasOwnProperty(b)?"constant.language":d.hasOwnProperty(b)?"invalid.illegal":b=="debugger"?"invalid.deprecated":"identifier"},regex:h},{token:"keyword.operator",regex:"!|\\$|%|&|\\*|\\-\\-|\\-|\\+\\+|\\+|~|===|==|=|!=|!==|<=|>=|<<=|>>=|>>>=|<>|<|>|!|&&|\\|\\||\\?\\:|\\*=|%=|\\+=|\\-=|&=|\\^=|\\b(?:in|instanceof|new|delete|typeof|void)",next:"regex_allowed"},{token:"lparen",regex:"[[({]",next:"regex_allowed"},{token:"rparen",regex:"[\\])}]"},{token:"keyword.operator",regex:"\\/=?",next:"regex_allowed"},{token:"comment",regex:"^#!.*$"},{token:"text",regex:"\\s+"}],regex_allowed:[{token:"comment",regex:"\\/\\/.*$"},{token:"string.regexp",regex:"\\/(?:(?:\\[(?:\\\\]|[^\\]])+\\])|(?:\\\\/|[^\\]/]))*[/]\\w*",next:"start"},{token:"text",regex:"\\s+"},{token:"empty",regex:"",next:"start"}],comment:[{token:"comment",regex:".*?\\*\\/",next:"start"},{token:"comment",merge:!0,regex:".+"}],qqstring:[{token:"string",regex:'(?:(?:\\\\.)|(?:[^"\\\\]))*?"',next:"start"},{token:"string",merge:!0,regex:".+"}],qstring:[{token:"string",regex:"(?:(?:\\\\.)|(?:[^'\\\\]))*?'",next:"start"},{token:"string",merge:!0,regex:".+"}]},this.embedRules(g,"doc-",[(new g).getEndRule("start")])};d.inherits(i,h),b.JavaScriptHighlightRules=i}),define("ace/mode/doc_comment_highlight_rules",["require","exports","module","pilot/oop","ace/mode/text_highlight_rules"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/text_highlight_rules").TextHighlightRules,f=function(){this.$rules={start:[{token:"comment.doc.tag",regex:"@[\\w\\d_]+"},{token:"comment.doc",merge:!0,regex:"\\s+"},{token:"comment.doc",merge:!0,regex:"TODO"},{token:"comment.doc",merge:!0,regex:"[^@\\*]+"},{token:"comment.doc",merge:!0,regex:"."}]}};d.inherits(f,e),function(){this.getStartRule=function(a){return{token:"comment.doc",merge:!0,regex:"\\/\\*(?=\\*)",next:a}},this.getEndRule=function(a){return{token:"comment.doc",merge:!0,regex:"\\*\\/",next:a}}}.call(f.prototype),b.DocCommentHighlightRules=f}),define("ace/mode/matching_brace_outdent",["require","exports","module","ace/range"],function(a,b,c){var d=a("ace/range").Range,e=function(){};(function(){this.checkOutdent=function(a,b){return/^\s+$/.test(a)?/^\s*\}/.test(b):!1},this.autoOutdent=function(a,b){var c=a.getLine(b),e=c.match(/^(\s*\})/);if(!e)return 0;var f=e[1].length,g=a.findMatchingBracket({row:b,column:f});if(!g||g.row==b)return 0;var h=this.$getIndent(a.getLine(g.row));a.replace(new d(b,0,b,f-1),h)},this.$getIndent=function(a){var b=a.match(/^(\s+)/);return b?b[1]:""}}).call(e.prototype),b.MatchingBraceOutdent=e}),define("ace/worker/worker_client",["require","exports","module","pilot/oop","pilot/event_emitter"],function(a,b,c){var d=a("pilot/oop"),e=a("pilot/event_emitter").EventEmitter,f=function(b,c,d,e){this.callbacks=[];if(a.packaged)var f=this.$guessBasePath(),g=this.$worker=new Worker(f+c);else{var h=this.$normalizePath(a.nameToUrl("ace/worker/worker",null,"_")),g=this.$worker=new Worker(h),i={};for(var j=0;j<b.length;j++){var k=b[j],l=this.$normalizePath(a.nameToUrl(k,null,"_").replace(/.js$/,""));i[k]=l}}this.$worker.postMessage({init:!0,tlns:i,module:d,classname:e}),this.callbackId=1,this.callbacks={};var m=this;this.$worker.onerror=function(a){throw window.console&&console.log&&console.log(a),a},this.$worker.onmessage=function(a){var b=a.data;switch(b.type){case"log":window.console&&console.log&&console.log(b.data);break;case"event":m._dispatchEvent(b.name,{data:b.data});break;case"call":var c=m.callbacks[b.id];c&&(c(b.data),delete m.callbacks[b.id])}}};(function(){d.implement(this,e),this.$normalizePath=function(a){return a.match(/^\w+:/)||(a=location.protocol+"//"+location.host+(a.charAt(0)=="/"?"":location.pathname.replace(/\/[^\/]*$/,""))+"/"+a.replace(/^[\/]+/,"")),a},this.$guessBasePath=function(){if(a.aceBaseUrl)return a.aceBaseUrl;var b=document.getElementsByTagName("script");for(var c=0;c<b.length;c++){var d=b[c],e=d.getAttribute("data-ace-base");if(e)return e.replace(/\/*$/,"/");var f=d.src||d.getAttribute("src");if(!f)continue;var g=f.match(/^(?:(.*\/)ace\.js|(.*\/)ace-uncompressed\.js)(?:\?|$)/);if(g)return g[1]||g[2]}return""},this.terminate=function(){this._dispatchEvent("terminate",{}),this.$worker.terminate()},this.send=function(a,b){this.$worker.postMessage({command:a,args:b})},this.call=function(a,b,c){if(c){var d=this.callbackId++;this.callbacks[d]=c,b.push(d)}this.send(a,b)},this.emit=function(a,b){this.$worker.postMessage({event:a,data:b})}}).call(f.prototype),b.WorkerClient=f}),define("ace/mode/behaviour/cstyle",["require","exports","module","pilot/oop","ace/mode/behaviour"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/behaviour").Behaviour,f=function(){this.add("braces","insertion",function(a,b,c,d,e){if(e=="{"){var f=c.getSelectionRange(),g=d.doc.getTextRange(f);return g!==""?{text:"{"+g+"}",selection:!1}:{text:"{}",selection:[1,1]}}if(e=="}"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column,h.column+1);if(j=="}"){var k=d.$findOpeningBracket("}",{column:h.column+1,row:h.row});if(k!==null)return{text:"",selection:[1,1]}}}else if(e=="\n"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column,h.column+1);if(j=="}"){var l=d.findMatchingBracket({row:h.row,column:h.column+1});if(!l)return!1;var m=this.getNextLineIndent(a,i.substring(0,i.length-1),d.getTabString()),n=this.$getIndent(d.doc.getLine(l.row));return{text:"\n"+m+"\n"+n,selection:[1,m.length,1,m.length]}}}return!1}),this.add("braces","deletion",function(a,b,c,d,e){var f=d.doc.getTextRange(e);if(!e.isMultiLine()&&f=="{"){var g=d.doc.getLine(e.start.row),h=g.substring(e.end.column,e.end.column+1);if(h=="}")return e.end.column++,e}return!1}),this.add("parens","insertion",function(a,b,c,d,e){if(e=="("){var f=c.getSelectionRange(),g=d.doc.getTextRange(f);return g!==""?{text:"("+g+")",selection:!1}:{text:"()",selection:[1,1]}}if(e==")"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column,h.column+1);if(j==")"){var k=d.$findOpeningBracket(")",{column:h.column+1,row:h.row});if(k!==null)return{text:"",selection:[1,1]}}}return!1}),this.add("parens","deletion",function(a,b,c,d,e){var f=d.doc.getTextRange(e);if(!e.isMultiLine()&&f=="("){var g=d.doc.getLine(e.start.row),h=g.substring(e.start.column+1,e.start.column+2);if(h==")")return e.end.column++,e}return!1}),this.add("string_dquotes","insertion",function(a,b,c,d,e){if(e=='"'){var f=c.getSelectionRange(),g=d.doc.getTextRange(f);if(g!=="")return{text:'"'+g+'"',selection:!1};var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column-1,h.column);if(j=="\\")return!1;var k=d.getTokens(f.start.row,f.start.row)[0].tokens,l=0,m,n=-1;for(var o=0;o<k.length;o++){m=k[o],m.type=="string"?n=-1:n<0&&(n=m.value.indexOf('"'));if(m.value.length+l>f.start.column)break;l+=k[o].value.length}if(!m||n<0&&m.type!=="comment"&&(m.type!=="string"||f.start.column!==m.value.length+l-1&&m.value.lastIndexOf('"')===m.value.length-1))return{text:'""',selection:[1,1]};if(m&&m.type==="string"){var p=i.substring(h.column,h.column+1);if(p=='"')return{text:"",selection:[1,1]}}}return!1}),this.add("string_dquotes","deletion",function(a,b,c,d,e){var f=d.doc.getTextRange(e);if(!e.isMultiLine()&&f=='"'){var g=d.doc.getLine(e.start.row),h=g.substring(e.start.column+1,e.start.column+2);if(h=='"')return e.end.column++,e}return!1})};d.inherits(f,e),b.CstyleBehaviour=f}),define("ace/mode/css",["require","exports","module","pilot/oop","ace/mode/text","ace/tokenizer","ace/mode/css_highlight_rules","ace/mode/matching_brace_outdent","ace/worker/worker_client"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/text").Mode,f=a("ace/tokenizer").Tokenizer,g=a("ace/mode/css_highlight_rules").CssHighlightRules,h=a("ace/mode/matching_brace_outdent").MatchingBraceOutdent,i=a("ace/worker/worker_client").WorkerClient,j=function(){this.$tokenizer=new f((new g).getRules()),this.$outdent=new h};d.inherits(j,e),function(){this.getNextLineIndent=function(a,b,c){var d=this.$getIndent(b),e=this.$tokenizer.getLineTokens(b,a).tokens;if(e.length&&e[e.length-1].type=="comment")return d;var f=b.match(/^.*\{\s*$/);return f&&(d+=c),d},this.checkOutdent=function(a,b,c){return this.$outdent.checkOutdent(b,c)},this.autoOutdent=function(a,b,c){this.$outdent.autoOutdent(b,c)},this.createWorker=function(a){var b=a.getDocument(),c=new i(["ace","pilot"],"worker-css.js","ace/mode/css_worker","Worker");c.call("setValue",[b.getValue()]),b.on("change",function(a){a.range={start:a.data.range.start,end:a.data.range.end},c.emit("change",a)}),c.on("csslint",function(b){var c=[];b.data.forEach(function(a){c.push({row:a.line-1,column:a.col-1,text:a.message,type:a.type,lint:a})}),a.setAnnotations(c)})}}.call(j.prototype),b.Mode=j}),define("ace/mode/css_highlight_rules",["require","exports","module","pilot/oop","pilot/lang","ace/mode/text_highlight_rules"],function(a,b,c){var d=a("pilot/oop"),e=a("pilot/lang"),f=a("ace/mode/text_highlight_rules").TextHighlightRules,g=function(){function g(a){var b=[],c=a.split("");for(var d=0;d<c.length;d++)b.push("[",c[d].toLowerCase(),c[d].toUpperCase(),"]");return b.join("")}var a=e.arrayToMap("-moz-box-sizing|-webkit-box-sizing|appearance|azimuth|background-attachment|background-color|background-image|background-position|background-repeat|background|border-bottom-color|border-bottom-style|border-bottom-width|border-bottom|border-collapse|border-color|border-left-color|border-left-style|border-left-width|border-left|border-right-color|border-right-style|border-right-width|border-right|border-spacing|border-style|border-top-color|border-top-style|border-top-width|border-top|border-width|border|bottom|box-sizing|caption-side|clear|clip|color|content|counter-increment|counter-reset|cue-after|cue-before|cue|cursor|direction|display|elevation|empty-cells|float|font-family|font-size-adjust|font-size|font-stretch|font-style|font-variant|font-weight|font|height|left|letter-spacing|line-height|list-style-image|list-style-position|list-style-type|list-style|margin-bottom|margin-left|margin-right|margin-top|marker-offset|margin|marks|max-height|max-width|min-height|min-width|-moz-border-radius|opacity|orphans|outline-color|outline-style|outline-width|outline|overflow|overflow-x|overflow-y|padding-bottom|padding-left|padding-right|padding-top|padding|page-break-after|page-break-before|page-break-inside|page|pause-after|pause-before|pause|pitch-range|pitch|play-during|position|quotes|richness|right|size|speak-header|speak-numeral|speak-punctuation|speech-rate|speak|stress|table-layout|text-align|text-decoration|text-indent|text-shadow|text-transform|top|unicode-bidi|vertical-align|visibility|voice-family|volume|white-space|widows|width|word-spacing|z-index".split("|")),b=e.arrayToMap("rgb|rgba|url|attr|counter|counters".split("|")),c=e.arrayToMap("absolute|all-scroll|always|armenian|auto|baseline|below|bidi-override|block|bold|bolder|border-box|both|bottom|break-all|break-word|capitalize|center|char|circle|cjk-ideographic|col-resize|collapse|content-box|crosshair|dashed|decimal-leading-zero|decimal|default|disabled|disc|distribute-all-lines|distribute-letter|distribute-space|distribute|dotted|double|e-resize|ellipsis|fixed|georgian|groove|hand|hebrew|help|hidden|hiragana-iroha|hiragana|horizontal|ideograph-alpha|ideograph-numeric|ideograph-parenthesis|ideograph-space|inactive|inherit|inline-block|inline|inset|inside|inter-ideograph|inter-word|italic|justify|katakana-iroha|katakana|keep-all|left|lighter|line-edge|line-through|line|list-item|loose|lower-alpha|lower-greek|lower-latin|lower-roman|lowercase|lr-tb|ltr|medium|middle|move|n-resize|ne-resize|newspaper|no-drop|no-repeat|nw-resize|none|normal|not-allowed|nowrap|oblique|outset|outside|overline|pointer|progress|relative|repeat-x|repeat-y|repeat|right|ridge|row-resize|rtl|s-resize|scroll|se-resize|separate|small-caps|solid|square|static|strict|super|sw-resize|table-footer-group|table-header-group|tb-rl|text-bottom|text-top|text|thick|thin|top|transparent|underline|upper-alpha|upper-latin|upper-roman|uppercase|vertical-ideographic|vertical-text|visible|w-resize|wait|whitespace|zero".split("|")),d=e.arrayToMap("aqua|black|blue|fuchsia|gray|green|lime|maroon|navy|olive|orange|purple|red|silver|teal|white|yellow".split("|")),f="\\-?(?:(?:[0-9]+)|(?:[0-9]*\\.[0-9]+))",h=[{token:"comment",merge:!0,regex:"\\/\\*",next:"ruleset_comment"},{token:"string",regex:'["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'},{token:"string",regex:"['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"},{token:"constant.numeric",regex:f+g("em")},{token:"constant.numeric",regex:f+g("ex")},{token:"constant.numeric",regex:f+g("px")},{token:"constant.numeric",regex:f+g("cm")},{token:"constant.numeric",regex:f+g("mm")},{token:"constant.numeric",regex:f+g("in")},{token:"constant.numeric",regex:f+g("pt")},{token:"constant.numeric",regex:f+g("pc")},{token:"constant.numeric",regex:f+g("deg")},{token:"constant.numeric",regex:f+g("rad")},{token:"constant.numeric",regex:f+g("grad")},{token:"constant.numeric",regex:f+g("ms")},{token:"constant.numeric",regex:f+g("s")},{token:"constant.numeric",regex:f+g("hz")},{token:"constant.numeric",regex:f+g("khz")},{token:"constant.numeric",regex:f+"%"},{token:"constant.numeric",regex:f},{token:"constant.numeric",regex:"#[a-fA-F0-9]{6}"},{token:"constant.numeric",regex:"#[a-fA-F0-9]{3}"},{token:function(e){return a.hasOwnProperty(e.toLowerCase())?"support.type":b.hasOwnProperty(e.toLowerCase())?"support.function":c.hasOwnProperty(e.toLowerCase())?"support.constant":d.hasOwnProperty(e.toLowerCase())?"support.constant.color":"text"},regex:"\\-?[a-zA-Z_][a-zA-Z0-9_\\-]*"}],i=e.copyArray(h);i.unshift({token:"rparen",regex:"\\}",next:"start"});var j=e.copyArray(h);j.unshift({token:"rparen",regex:"\\}",next:"media"});var k=[{token:"comment",merge:!0,regex:".+"}],l=e.copyArray(k);l.unshift({token:"comment",regex:".*?\\*\\/",next:"start"});var m=e.copyArray(k);m.unshift({token:"comment",regex:".*?\\*\\/",next:"media"});var n=e.copyArray(k);n.unshift({token:"comment",regex:".*?\\*\\/",next:"ruleset"}),this.$rules={start:[{token:"comment",merge:!0,regex:"\\/\\*",next:"comment"},{token:"lparen",regex:"\\{",next:"ruleset"},{token:"string",regex:"@media.*?{",next:"media"},{token:"keyword",regex:"#[a-zA-Z0-9-_]+"},{token:"variable",regex:"\\.[a-zA-Z0-9-_]+"},{token:"string",regex:":[a-zA-Z0-9-_]+"},{token:"constant",regex:"[a-zA-Z0-9-_]+"}],media:[{token:"comment",merge:!0,regex:"\\/\\*",next:"media_comment"},{token:"lparen",regex:"\\{",next:"media_ruleset"},{token:"string",regex:"\\}",next:"start"},{token:"keyword",regex:"#[a-zA-Z0-9-_]+"},{token:"variable",regex:"\\.[a-zA-Z0-9-_]+"},{token:"string",regex:":[a-zA-Z0-9-_]+"},{token:"constant",regex:"[a-zA-Z0-9-_]+"}],comment:l,ruleset:i,ruleset_comment:n,media_ruleset:j,media_comment:m}};d.inherits(g,f),b.CssHighlightRules=g}),define("ace/mode/html_highlight_rules",["require","exports","module","pilot/oop","ace/mode/css_highlight_rules","ace/mode/javascript_highlight_rules","ace/mode/text_highlight_rules"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/css_highlight_rules").CssHighlightRules,f=a("ace/mode/javascript_highlight_rules").JavaScriptHighlightRules,g=a("ace/mode/text_highlight_rules").TextHighlightRules,h=function(){function a(a){return[{token:"string",regex:'".*?"'},{token:"string",merge:!0,regex:'["].*$',next:a+"-qqstring"},{token:"string",regex:"'.*?'"},{token:"string",merge:!0,regex:"['].*$",next:a+"-qstring"}]}function b(a,b){return[{token:"string",merge:!0,regex:".*"+a,next:b},{token:"string",merge:!0,regex:".+"}]}function c(c,d,e){c[d]=[{token:"text",regex:"\\s+"},{token:"meta.tag",regex:"[-_a-zA-Z0-9:]+",next:d+"-attribute-list"},{token:"empty",regex:"",next:d+"-attribute-list"}],c[d+"-qstring"]=b("'",d),c[d+"-qqstring"]=b('"',d),c[d+"-attribute-list"]=[{token:"text",regex:">",next:e},{token:"entity.other.attribute-name",regex:"[-_a-zA-Z0-9:]+"},{token:"constant.numeric",regex:"[+-]?\\d+(?:(?:\\.\\d*)?(?:[eE][+-]?\\d+)?)?\\b"},{token:"text",regex:"\\s+"}].concat(a(d))}this.$rules={start:[{token:"text",merge:!0,regex:"<\\!\\[CDATA\\[",next:"cdata"},{token:"xml_pe",regex:"<\\?.*?\\?>"},{token:"comment",merge:!0,regex:"<\\!--",next:"comment"},{token:"text",regex:"<(?=s*script)",next:"script"},{token:"text",regex:"<(?=s*style)",next:"css"},{token:"text",regex:"<\\/?",next:"tag"},{token:"text",regex:"\\s+"},{token:"text",regex:"[^<]+"}],cdata:[{token:"text",regex:"\\]\\]>",next:"start"},{token:"text",merge:!0,regex:"\\s+"},{token:"text",merge:!0,regex:".+"}],comment:[{token:"comment",regex:".*?-->",next:"start"},{token:"comment",merge:!0,regex:".+"}]},c(this.$rules,"tag","start"),c(this.$rules,"css","css-start"),c(this.$rules,"script","js-start"),this.embedRules(f,"js-",[{token:"comment",regex:"\\/\\/.*(?=<\\/script>)",next:"tag"},{token:"text",regex:"<\\/(?=script)",next:"tag"}]),this.embedRules(e,"css-",[{token:"text",regex:"<\\/(?=style)",next:"tag"}])};d.inherits(h,g),b.HtmlHighlightRules=h}),define("ace/mode/behaviour/xml",["require","exports","module","pilot/oop","ace/mode/behaviour","ace/mode/behaviour/cstyle"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/behaviour").Behaviour,f=a("ace/mode/behaviour/cstyle").CstyleBehaviour,g=function(){this.inherit(f,["string_dquotes"]),this.add("brackets","insertion",function(a,b,c,d,e){if(e=="<"){var f=c.getSelectionRange(),g=d.doc.getTextRange(f);return g!==""?!1:{text:"<>",selection:[1,1]}}if(e==">"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column,h.column+1);if(j==">")return{text:"",selection:[1,1]}}else if(e=="\n"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),k=i.substring(h.column,h.column+2);if(k=="</"){var l=this.$getIndent(d.doc.getLine(h.row))+d.getTabString(),m=this.$getIndent(d.doc.getLine(h.row));return{text:"\n"+l+"\n"+m,selection:[1,l.length,1,l.length]}}}return!1})};d.inherits(g,e),b.XmlBehaviour=g})
/* Source: ace/mode-xml.js */
define("ace/mode/xml",["require","exports","module","pilot/oop","ace/mode/text","ace/tokenizer","ace/mode/xml_highlight_rules","ace/mode/behaviour/xml"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/text").Mode,f=a("ace/tokenizer").Tokenizer,g=a("ace/mode/xml_highlight_rules").XmlHighlightRules,h=a("ace/mode/behaviour/xml").XmlBehaviour,i=function(){this.$tokenizer=new f((new g).getRules()),this.$behaviour=new h};d.inherits(i,e),function(){this.getNextLineIndent=function(a,b,c){return this.$getIndent(b)}}.call(i.prototype),b.Mode=i}),define("ace/mode/xml_highlight_rules",["require","exports","module","pilot/oop","ace/mode/text_highlight_rules"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/text_highlight_rules").TextHighlightRules,f=function(){this.$rules={start:[{token:"text",regex:"<\\!\\[CDATA\\[",next:"cdata"},{token:"xml_pe",regex:"<\\?.*?\\?>"},{token:"comment",merge:!0,regex:"<\\!--",next:"comment"},{token:"text",regex:"<\\/?",next:"tag"},{token:"text",regex:"\\s+"},{token:"text",regex:"[^<]+"}],tag:[{token:"text",regex:">",next:"start"},{token:"keyword",regex:"[-_a-zA-Z0-9:]+"},{token:"text",regex:"\\s+"},{token:"string",regex:'".*?"'},{token:"string",merge:!0,regex:'["].*$',next:"qqstring"},{token:"string",regex:"'.*?'"},{token:"string",merge:!0,regex:"['].*$",next:"qstring"}],qstring:[{token:"string",regex:".*'",next:"tag"},{token:"string",merge:!0,regex:".+"}],qqstring:[{token:"string",regex:'.*"',next:"tag"},{token:"string",merge:!0,regex:".+"}],cdata:[{token:"text",regex:"\\]\\]>",next:"start"},{token:"text",regex:"\\s+"},{token:"text",regex:"(?:[^\\]]|\\](?!\\]>))+"}],comment:[{token:"comment",regex:".*?-->",next:"start"},{token:"comment",merge:!0,regex:".+"}]}};d.inherits(f,e),b.XmlHighlightRules=f}),define("ace/mode/behaviour/xml",["require","exports","module","pilot/oop","ace/mode/behaviour","ace/mode/behaviour/cstyle"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/behaviour").Behaviour,f=a("ace/mode/behaviour/cstyle").CstyleBehaviour,g=function(){this.inherit(f,["string_dquotes"]),this.add("brackets","insertion",function(a,b,c,d,e){if(e=="<"){var f=c.getSelectionRange(),g=d.doc.getTextRange(f);return g!==""?!1:{text:"<>",selection:[1,1]}}if(e==">"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column,h.column+1);if(j==">")return{text:"",selection:[1,1]}}else if(e=="\n"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),k=i.substring(h.column,h.column+2);if(k=="</"){var l=this.$getIndent(d.doc.getLine(h.row))+d.getTabString(),m=this.$getIndent(d.doc.getLine(h.row));return{text:"\n"+l+"\n"+m,selection:[1,l.length,1,l.length]}}}return!1})};d.inherits(g,e),b.XmlBehaviour=g}),define("ace/mode/behaviour/cstyle",["require","exports","module","pilot/oop","ace/mode/behaviour"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/behaviour").Behaviour,f=function(){this.add("braces","insertion",function(a,b,c,d,e){if(e=="{"){var f=c.getSelectionRange(),g=d.doc.getTextRange(f);return g!==""?{text:"{"+g+"}",selection:!1}:{text:"{}",selection:[1,1]}}if(e=="}"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column,h.column+1);if(j=="}"){var k=d.$findOpeningBracket("}",{column:h.column+1,row:h.row});if(k!==null)return{text:"",selection:[1,1]}}}else if(e=="\n"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column,h.column+1);if(j=="}"){var l=d.findMatchingBracket({row:h.row,column:h.column+1});if(!l)return!1;var m=this.getNextLineIndent(a,i.substring(0,i.length-1),d.getTabString()),n=this.$getIndent(d.doc.getLine(l.row));return{text:"\n"+m+"\n"+n,selection:[1,m.length,1,m.length]}}}return!1}),this.add("braces","deletion",function(a,b,c,d,e){var f=d.doc.getTextRange(e);if(!e.isMultiLine()&&f=="{"){var g=d.doc.getLine(e.start.row),h=g.substring(e.end.column,e.end.column+1);if(h=="}")return e.end.column++,e}return!1}),this.add("parens","insertion",function(a,b,c,d,e){if(e=="("){var f=c.getSelectionRange(),g=d.doc.getTextRange(f);return g!==""?{text:"("+g+")",selection:!1}:{text:"()",selection:[1,1]}}if(e==")"){var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column,h.column+1);if(j==")"){var k=d.$findOpeningBracket(")",{column:h.column+1,row:h.row});if(k!==null)return{text:"",selection:[1,1]}}}return!1}),this.add("parens","deletion",function(a,b,c,d,e){var f=d.doc.getTextRange(e);if(!e.isMultiLine()&&f=="("){var g=d.doc.getLine(e.start.row),h=g.substring(e.start.column+1,e.start.column+2);if(h==")")return e.end.column++,e}return!1}),this.add("string_dquotes","insertion",function(a,b,c,d,e){if(e=='"'){var f=c.getSelectionRange(),g=d.doc.getTextRange(f);if(g!=="")return{text:'"'+g+'"',selection:!1};var h=c.getCursorPosition(),i=d.doc.getLine(h.row),j=i.substring(h.column-1,h.column);if(j=="\\")return!1;var k=d.getTokens(f.start.row,f.start.row)[0].tokens,l=0,m,n=-1;for(var o=0;o<k.length;o++){m=k[o],m.type=="string"?n=-1:n<0&&(n=m.value.indexOf('"'));if(m.value.length+l>f.start.column)break;l+=k[o].value.length}if(!m||n<0&&m.type!=="comment"&&(m.type!=="string"||f.start.column!==m.value.length+l-1&&m.value.lastIndexOf('"')===m.value.length-1))return{text:'""',selection:[1,1]};if(m&&m.type==="string"){var p=i.substring(h.column,h.column+1);if(p=='"')return{text:"",selection:[1,1]}}}return!1}),this.add("string_dquotes","deletion",function(a,b,c,d,e){var f=d.doc.getTextRange(e);if(!e.isMultiLine()&&f=='"'){var g=d.doc.getLine(e.start.row),h=g.substring(e.start.column+1,e.start.column+2);if(h=='"')return e.end.column++,e}return!1})};d.inherits(f,e),b.CstyleBehaviour=f})
/* Source: ace/mode-css.js */
define("ace/mode/css",["require","exports","module","pilot/oop","ace/mode/text","ace/tokenizer","ace/mode/css_highlight_rules","ace/mode/matching_brace_outdent","ace/worker/worker_client"],function(a,b,c){var d=a("pilot/oop"),e=a("ace/mode/text").Mode,f=a("ace/tokenizer").Tokenizer,g=a("ace/mode/css_highlight_rules").CssHighlightRules,h=a("ace/mode/matching_brace_outdent").MatchingBraceOutdent,i=a("ace/worker/worker_client").WorkerClient,j=function(){this.$tokenizer=new f((new g).getRules()),this.$outdent=new h};d.inherits(j,e),function(){this.getNextLineIndent=function(a,b,c){var d=this.$getIndent(b),e=this.$tokenizer.getLineTokens(b,a).tokens;if(e.length&&e[e.length-1].type=="comment")return d;var f=b.match(/^.*\{\s*$/);return f&&(d+=c),d},this.checkOutdent=function(a,b,c){return this.$outdent.checkOutdent(b,c)},this.autoOutdent=function(a,b,c){this.$outdent.autoOutdent(b,c)},this.createWorker=function(a){var b=a.getDocument(),c=new i(["ace","pilot"],"worker-css.js","ace/mode/css_worker","Worker");c.call("setValue",[b.getValue()]),b.on("change",function(a){a.range={start:a.data.range.start,end:a.data.range.end},c.emit("change",a)}),c.on("csslint",function(b){var c=[];b.data.forEach(function(a){c.push({row:a.line-1,column:a.col-1,text:a.message,type:a.type,lint:a})}),a.setAnnotations(c)})}}.call(j.prototype),b.Mode=j}),define("ace/mode/css_highlight_rules",["require","exports","module","pilot/oop","pilot/lang","ace/mode/text_highlight_rules"],function(a,b,c){var d=a("pilot/oop"),e=a("pilot/lang"),f=a("ace/mode/text_highlight_rules").TextHighlightRules,g=function(){function g(a){var b=[],c=a.split("");for(var d=0;d<c.length;d++)b.push("[",c[d].toLowerCase(),c[d].toUpperCase(),"]");return b.join("")}var a=e.arrayToMap("-moz-box-sizing|-webkit-box-sizing|appearance|azimuth|background-attachment|background-color|background-image|background-position|background-repeat|background|border-bottom-color|border-bottom-style|border-bottom-width|border-bottom|border-collapse|border-color|border-left-color|border-left-style|border-left-width|border-left|border-right-color|border-right-style|border-right-width|border-right|border-spacing|border-style|border-top-color|border-top-style|border-top-width|border-top|border-width|border|bottom|box-sizing|caption-side|clear|clip|color|content|counter-increment|counter-reset|cue-after|cue-before|cue|cursor|direction|display|elevation|empty-cells|float|font-family|font-size-adjust|font-size|font-stretch|font-style|font-variant|font-weight|font|height|left|letter-spacing|line-height|list-style-image|list-style-position|list-style-type|list-style|margin-bottom|margin-left|margin-right|margin-top|marker-offset|margin|marks|max-height|max-width|min-height|min-width|-moz-border-radius|opacity|orphans|outline-color|outline-style|outline-width|outline|overflow|overflow-x|overflow-y|padding-bottom|padding-left|padding-right|padding-top|padding|page-break-after|page-break-before|page-break-inside|page|pause-after|pause-before|pause|pitch-range|pitch|play-during|position|quotes|richness|right|size|speak-header|speak-numeral|speak-punctuation|speech-rate|speak|stress|table-layout|text-align|text-decoration|text-indent|text-shadow|text-transform|top|unicode-bidi|vertical-align|visibility|voice-family|volume|white-space|widows|width|word-spacing|z-index".split("|")),b=e.arrayToMap("rgb|rgba|url|attr|counter|counters".split("|")),c=e.arrayToMap("absolute|all-scroll|always|armenian|auto|baseline|below|bidi-override|block|bold|bolder|border-box|both|bottom|break-all|break-word|capitalize|center|char|circle|cjk-ideographic|col-resize|collapse|content-box|crosshair|dashed|decimal-leading-zero|decimal|default|disabled|disc|distribute-all-lines|distribute-letter|distribute-space|distribute|dotted|double|e-resize|ellipsis|fixed|georgian|groove|hand|hebrew|help|hidden|hiragana-iroha|hiragana|horizontal|ideograph-alpha|ideograph-numeric|ideograph-parenthesis|ideograph-space|inactive|inherit|inline-block|inline|inset|inside|inter-ideograph|inter-word|italic|justify|katakana-iroha|katakana|keep-all|left|lighter|line-edge|line-through|line|list-item|loose|lower-alpha|lower-greek|lower-latin|lower-roman|lowercase|lr-tb|ltr|medium|middle|move|n-resize|ne-resize|newspaper|no-drop|no-repeat|nw-resize|none|normal|not-allowed|nowrap|oblique|outset|outside|overline|pointer|progress|relative|repeat-x|repeat-y|repeat|right|ridge|row-resize|rtl|s-resize|scroll|se-resize|separate|small-caps|solid|square|static|strict|super|sw-resize|table-footer-group|table-header-group|tb-rl|text-bottom|text-top|text|thick|thin|top|transparent|underline|upper-alpha|upper-latin|upper-roman|uppercase|vertical-ideographic|vertical-text|visible|w-resize|wait|whitespace|zero".split("|")),d=e.arrayToMap("aqua|black|blue|fuchsia|gray|green|lime|maroon|navy|olive|orange|purple|red|silver|teal|white|yellow".split("|")),f="\\-?(?:(?:[0-9]+)|(?:[0-9]*\\.[0-9]+))",h=[{token:"comment",merge:!0,regex:"\\/\\*",next:"ruleset_comment"},{token:"string",regex:'["](?:(?:\\\\.)|(?:[^"\\\\]))*?["]'},{token:"string",regex:"['](?:(?:\\\\.)|(?:[^'\\\\]))*?[']"},{token:"constant.numeric",regex:f+g("em")},{token:"constant.numeric",regex:f+g("ex")},{token:"constant.numeric",regex:f+g("px")},{token:"constant.numeric",regex:f+g("cm")},{token:"constant.numeric",regex:f+g("mm")},{token:"constant.numeric",regex:f+g("in")},{token:"constant.numeric",regex:f+g("pt")},{token:"constant.numeric",regex:f+g("pc")},{token:"constant.numeric",regex:f+g("deg")},{token:"constant.numeric",regex:f+g("rad")},{token:"constant.numeric",regex:f+g("grad")},{token:"constant.numeric",regex:f+g("ms")},{token:"constant.numeric",regex:f+g("s")},{token:"constant.numeric",regex:f+g("hz")},{token:"constant.numeric",regex:f+g("khz")},{token:"constant.numeric",regex:f+"%"},{token:"constant.numeric",regex:f},{token:"constant.numeric",regex:"#[a-fA-F0-9]{6}"},{token:"constant.numeric",regex:"#[a-fA-F0-9]{3}"},{token:function(e){return a.hasOwnProperty(e.toLowerCase())?"support.type":b.hasOwnProperty(e.toLowerCase())?"support.function":c.hasOwnProperty(e.toLowerCase())?"support.constant":d.hasOwnProperty(e.toLowerCase())?"support.constant.color":"text"},regex:"\\-?[a-zA-Z_][a-zA-Z0-9_\\-]*"}],i=e.copyArray(h);i.unshift({token:"rparen",regex:"\\}",next:"start"});var j=e.copyArray(h);j.unshift({token:"rparen",regex:"\\}",next:"media"});var k=[{token:"comment",merge:!0,regex:".+"}],l=e.copyArray(k);l.unshift({token:"comment",regex:".*?\\*\\/",next:"start"});var m=e.copyArray(k);m.unshift({token:"comment",regex:".*?\\*\\/",next:"media"});var n=e.copyArray(k);n.unshift({token:"comment",regex:".*?\\*\\/",next:"ruleset"}),this.$rules={start:[{token:"comment",merge:!0,regex:"\\/\\*",next:"comment"},{token:"lparen",regex:"\\{",next:"ruleset"},{token:"string",regex:"@media.*?{",next:"media"},{token:"keyword",regex:"#[a-zA-Z0-9-_]+"},{token:"variable",regex:"\\.[a-zA-Z0-9-_]+"},{token:"string",regex:":[a-zA-Z0-9-_]+"},{token:"constant",regex:"[a-zA-Z0-9-_]+"}],media:[{token:"comment",merge:!0,regex:"\\/\\*",next:"media_comment"},{token:"lparen",regex:"\\{",next:"media_ruleset"},{token:"string",regex:"\\}",next:"start"},{token:"keyword",regex:"#[a-zA-Z0-9-_]+"},{token:"variable",regex:"\\.[a-zA-Z0-9-_]+"},{token:"string",regex:":[a-zA-Z0-9-_]+"},{token:"constant",regex:"[a-zA-Z0-9-_]+"}],comment:l,ruleset:i,ruleset_comment:n,media_ruleset:j,media_comment:m}};d.inherits(g,f),b.CssHighlightRules=g}),define("ace/mode/matching_brace_outdent",["require","exports","module","ace/range"],function(a,b,c){var d=a("ace/range").Range,e=function(){};(function(){this.checkOutdent=function(a,b){return/^\s+$/.test(a)?/^\s*\}/.test(b):!1},this.autoOutdent=function(a,b){var c=a.getLine(b),e=c.match(/^(\s*\})/);if(!e)return 0;var f=e[1].length,g=a.findMatchingBracket({row:b,column:f});if(!g||g.row==b)return 0;var h=this.$getIndent(a.getLine(g.row));a.replace(new d(b,0,b,f-1),h)},this.$getIndent=function(a){var b=a.match(/^(\s+)/);return b?b[1]:""}}).call(e.prototype),b.MatchingBraceOutdent=e}),define("ace/worker/worker_client",["require","exports","module","pilot/oop","pilot/event_emitter"],function(a,b,c){var d=a("pilot/oop"),e=a("pilot/event_emitter").EventEmitter,f=function(b,c,d,e){this.callbacks=[];if(a.packaged)var f=this.$guessBasePath(),g=this.$worker=new Worker(f+c);else{var h=this.$normalizePath(a.nameToUrl("ace/worker/worker",null,"_")),g=this.$worker=new Worker(h),i={};for(var j=0;j<b.length;j++){var k=b[j],l=this.$normalizePath(a.nameToUrl(k,null,"_").replace(/.js$/,""));i[k]=l}}this.$worker.postMessage({init:!0,tlns:i,module:d,classname:e}),this.callbackId=1,this.callbacks={};var m=this;this.$worker.onerror=function(a){throw window.console&&console.log&&console.log(a),a},this.$worker.onmessage=function(a){var b=a.data;switch(b.type){case"log":window.console&&console.log&&console.log(b.data);break;case"event":m._dispatchEvent(b.name,{data:b.data});break;case"call":var c=m.callbacks[b.id];c&&(c(b.data),delete m.callbacks[b.id])}}};(function(){d.implement(this,e),this.$normalizePath=function(a){return a.match(/^\w+:/)||(a=location.protocol+"//"+location.host+(a.charAt(0)=="/"?"":location.pathname.replace(/\/[^\/]*$/,""))+"/"+a.replace(/^[\/]+/,"")),a},this.$guessBasePath=function(){if(a.aceBaseUrl)return a.aceBaseUrl;var b=document.getElementsByTagName("script");for(var c=0;c<b.length;c++){var d=b[c],e=d.getAttribute("data-ace-base");if(e)return e.replace(/\/*$/,"/");var f=d.src||d.getAttribute("src");if(!f)continue;var g=f.match(/^(?:(.*\/)ace\.js|(.*\/)ace-uncompressed\.js)(?:\?|$)/);if(g)return g[1]||g[2]}return""},this.terminate=function(){this._dispatchEvent("terminate",{}),this.$worker.terminate()},this.send=function(a,b){this.$worker.postMessage({command:a,args:b})},this.call=function(a,b,c){if(c){var d=this.callbackId++;this.callbacks[d]=c,b.push(d)}this.send(a,b)},this.emit=function(a,b){this.$worker.postMessage({event:a,data:b})}}).call(f.prototype),b.WorkerClient=f})
/* Source: scripts/ace.js */
namespace.module('com.pageforest.editor.ace', function(exports, require) {

    var editor;
    var visible = false;
    var JavascriptMode = window.require('ace/mode/javascript').Mode;
    var JSONMode = window.require('ace/mode/javascript').Mode;
    var CSSMode = window.require('ace/mode/css').Mode;
    var HTMLMode = window.require('ace/mode/html').Mode;
    var XMLMode = window.require('ace/mode/xml').Mode;

    exports.extend({
        createEditor: createEditor,
        loadFile: loadFile,
        adjustHeight: adjustHeight,
        getData: getData,
        editor: editor,
        view: view
    });

    // hides/shows/returns if visible
    function view(action) {
        if (action == 'show') {
            visible = true;
            $('#ace').css('visibility', 'visible');
            return true;
        } else if (action == 'hide') {
            visible = false;
            $('#ace').css('visibility', 'hidden');
            return false;
        } else {
            return visible;
        }
    }

    // Create an ace and put it in the content div.
    function createEditor() {
        $('#ace').css('height', window.innerHeight - 43 + 'px');
        $('#ace').css('width', window.innerWidth + 'px');
        editor = ace.edit('ace');
        editor.renderer.$horizScrollAlwaysVisible = false;   // make horiz scrollbar optional
    }

    function loadFile(filename, data) {
        var lower = filename.toLowerCase();
        if (lower.substr(-5) == '.html') {
            editor.getSession().setMode(new HTMLMode());
        } else if (lower.substr(-4) == '.xml') {
            editor.getSession().setMode(new XMLMode());
        } else if (lower.substr(-3) == '.js') {
            editor.getSession().setMode(new JavascriptMode());
        } else if (lower.substr(-5) == '.json') {
            editor.getSession().setMode(new JSONMode());
        } else if (lower.substr(-4) == '.css') {
            editor.getSession().setMode(new CSSMode());
        } else {
            editor.getSession().setMode(new HTMLMode());
        }
        editor.getSession().setValue(data);
    }

    // Make the CodeMirror shorter or longer, after a new file is loaded.
    function adjustHeight(shrink) {
        console.log('adjustHeight() from ace');
/*        if (!codemirror || !codemirror.editor) {
            return;
        }
        var body = codemirror.editor.container;
        var scrollHeight = body.scrollHeight;
        // var offsetHeight = body.offsetHeight;
        // console.log(body, scrollHeight, offsetHeight);
        var wrapping = $('.CodeMirror-wrapping');
        wrapping.css('height', scrollHeight + 'px');*/
    }

    // Get the edited file content from the editor.
    function getData() {
        return editor.getSession().getValue();
    }

});
