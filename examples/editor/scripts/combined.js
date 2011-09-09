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
                ns.listing = message.items;
                if (!ns.filename || ns.filename.substr(-1) == '/') {
                    showFiles();
                }
            }
        });
    }

    function loadFile(filename) {
        ns.filename = filename;
        updateBreadcrumbs();
        if (filename == '' || filename.substr(-1) == '/') {
            showFiles();
        } else {
            $.ajax({
                url: '/mirror/' + ns.app_id + '/' + ns.filename,
                dataType: 'text',
                error: onError,
                success: function(message) {
                    ns.editor.createEditor(ns.filename, message);
                    ns.editor.adjustHeight('shrink');
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
        // console.log('User-Agent: ' + navigator.userAgent);
        var codemirror = namespace.lookup('com.pageforest.editor.codemirror');
        if (codemirror.isProbablySupported()) {
            return codemirror;
        } else {
            return namespace.lookup('com.pageforest.editor.textarea');
        }
    }

    function onReady() {
        var clientLib = namespace.lookup('com.pageforest.client');
        ns.client = new clientLib.Client(exports);
        ns.client.saveInterval = 0;  // Turn off auto-save.
        ns.client.state = 'clean';   // Turn off beforeUnload.
        ns.hash = '###';  // Not initialized, wait for checkHash to update.
        ns.editor = guessEditor();
        ns.app_id = '';
        ns.filename = '';
        // Start polling for window.location.hash changes and iframe.
        setInterval(checkHash, 200);
        setInterval(checkIFrame, 1000);
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

    exports.extend({
        createEditor: createEditor,
        adjustHeight: adjustHeight,
        getData: getData
    });

    // Create a textarea and put it in the content div.
    function createEditor(filename, data) {
        var code = $('<textarea id="code"></textarea>');
        $('#content').empty().append(code);
        code.val(data).focus();
    }

    // Make the textarea shorter or longer, after a new file is loaded.
    function adjustHeight(shrink) {
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
