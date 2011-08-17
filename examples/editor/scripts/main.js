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
        ns.client = new clientLib.Client(ns);
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
