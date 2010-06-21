namespace.lookup('com.pageforest.editor').define(function (ns) {

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
        $('#status').html(message);
    }

    function onError(xhr, status, message) {
        showStatus(xhr.status + ' ' + xhr.statusText);
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

    function showFiles() {
        var path = ns.filename;
        // Remove trailing slash.
        if (path.substr(-1) == '/') {
            path = path.substr(0, path.length - 1);
        }
        var html = [];
        getFoldersAndFiles(path).forEach(function(filename) {
            var href = ns.app_id + '/' + (path ? path + '/' : '') + filename;
            var icon = getIcon(href);
            html.push('<div class="icon">');
            html.push('<a href="#' + href + '">' + icon + '</a><br />');
            html.push('<a href="#' + href + '">' + filename + '</a>');
            html.push('</div>');
        });
        $('#content').html(html.join('\n'));
        updateBreadcrumbs();
    }

    function onListSuccess(message, status, xhr) {
        ns.listing = message;
        showFiles();
    }

    function loadApp(app_id) {
        console.log('loadApp ' + app_id);
        ns.app_id = app_id;
        $.ajax({
            url: '/mirror/' + ns.app_id + '?method=list&depth=0',
            dataType: 'json',
            success: onListSuccess,
            error: onError
        });
    }

    // Make the text area longer, if the user has added more lines.
    function growTextArea() {
        var textarea = $('#code');
        var scrollHeight = textarea.attr('scrollHeight');
        var offsetHeight = textarea.attr('offsetHeight');
        if (scrollHeight > offsetHeight) {
            console.log('growTextArea ' + offsetHeight + ' ' + scrollHeight);
            textarea.css('height', scrollHeight + 'px');
        }
    }

    // Make the text area shorter or longer, after a new file is loaded.
    function adjustTextArea() {
        var textarea = $('#code');
        var scrollHeight = textarea.attr('scrollHeight');
        var offsetHeight = textarea.attr('offsetHeight');
        while (offsetHeight && scrollHeight == offsetHeight) {
            textarea.css('height', (offsetHeight / 2) + 'px');
            scrollHeight = textarea.attr('scrollHeight');
            offsetHeight = textarea.attr('offsetHeight');
        }
        console.log('adjustTextArea ' + offsetHeight + ' ' + scrollHeight);
        textarea.css('height', scrollHeight + 'px');
    }

    function onLoadFileSuccess(message, status, xhr) {
        if (typeof ns.codemirror == 'object') {
            ns.codemirror.setCode(message);
            if (ns.filename.substr(-5) == '.html') {
                ns.codemirror.setParser('HTMLMixedParser');
            } else if (ns.filename.substr(-3) == '.js') {
                ns.codemirror.setParser('JSParser');
            } else if (ns.filename.substr(-5) == '.json') {
                ns.codemirror.setParser('JSParser');
            } else if (ns.filename.substr(-4) == '.css') {
                ns.codemirror.setParser('CSSParser');
            } else {
                ns.codemirror.setParser('DummyParser');
            }
            ns.codemirror.focus();
        } else {
            $('#code').val(message).focus();
            adjustTextArea();
        }
        showStatus("Loaded file " + ns.filename);
        updateBreadcrumbs();
    }

    function loadFile(filename) {
        ns.filename = filename;
        if (filename == '' || filename.substr(-1) == '/') {
            showFiles();
        } else {
            $.ajax({
                url: '/mirror/' + ns.app_id + '/' + ns.filename,
                dataType: 'text',
                success: onLoadFileSuccess,
                error: onError
            });
        }
    }

    function checkHash() {
        var hash = window.location.hash;
        if (hash == ns.hash) {
            growTextArea();
            return;
        }
        ns.hash = hash;
        // Split hash into app_id and filename.
        var parts = hash.substr(1).split('/');
        var app_id = parts.shift();
        var filename = parts.join('/');
        if (app_id != ns.app_id) {
            loadApp(app_id);
            loadFile(filename);
        } else if (filename != ns.filename) {
            loadFile(filename);
        }
    }

    function onReady() {
        var clientLib = namespace.lookup('com.pageforest.client');
        ns.client = new clientLib.Client(ns);
        ns.client.saveInterval = 0;  // Turn off auto-save.
        ns.client.state = 'clean';   // Turn off beforeUnload.
        ns.hash = '';
        ns.app_id = '';
        ns.filename = '';
        ns.editor = 'textarea';
        // Start polling for window.location.hash changes.
        setInterval(checkHash, 200);
    }

    // Convert textarea to CodeMirror editor with syntax highlighting.
    function onClickCodeMirror() {
        ns.codemirror = window.CodeMirror.fromTextArea("code", {
            path: "codemirror/js/",
            parserfile: [
                "parsexml.js",
                "parsecss.js",
                "tokenizejavascript.js",
                "parsejavascript.js",
                "parsehtmlmixed.js",
                "parsedummy.js"
            ],
            stylesheet: [
                "codemirror/css/xmlcolors.css",
                "codemirror/css/csscolors.css",
                "codemirror/css/jscolors.css"
            ]
        });
    }

    // Called when the current user changes (signs in or out)
    function onUserChange(username) {
        var isSignedIn = username != undefined;
        $('#username').text(isSignedIn ? username : 'anonymous');
        $('#signin').val(isSignedIn ? 'Sign Out' : 'Sign In');
    }

    function onChangeFilename() {
        window.location.hash = '#' + ns.app_id + '/' + $('#filename').val();
    }

    function onOpen() {

    }

    function onOptions() {
        $('#options').slideToggle();
    }

    function onSave() {
        $.ajax({
            type: 'PUT',
            url: '/mirror/' + ns.app_id + '/' + ns.filename,
            data: $('textarea').val(),
            dataType: 'text',
            success: function(message, status, xhr) {
                showStatus(message);
            },
            error: onError
        });
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

    // Exported functions
    ns.extend({
        onReady: onReady,
        onUserChange: onUserChange,
        onOpen: onOpen,
        onSave: onSave,
        onSignInOut: onSignInOut
    });

});
