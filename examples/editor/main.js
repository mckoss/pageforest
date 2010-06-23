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
    }

    function loadAppList() {
        ns.app_id = '';
        console.log('loadAppList');
        $.ajax({
            url: '/mirror?method=list&depth=0',
            dataType: 'json',
            error: onError,
            success: function(message) {
                ns.appListing = message;
                if (!ns.app_id) {
                    showApps();
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
                ns.listing = message;
                if (!ns.filename || ns.filename.substr(-1) == '/') {
                    showFiles();
                }
            }
        });
    }

    // Make the text area longer, if the user has added more lines.
    function growTextArea() {
        var textarea = $('#code');
        var scrollHeight = textarea.attr('scrollHeight');
        var offsetHeight = textarea.attr('offsetHeight');
        if (scrollHeight > offsetHeight) {
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
        textarea.css('height', scrollHeight + 'px');
    }

    function showTextArea(data) {
        var code = $('<textarea id="code"></textarea>');
        $('#content').empty().append(code);
        code.val(data).focus();
        adjustTextArea();
    }

    function showCodeMirror(data) {
        ns.codemirror.setCode(data);
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
    }

    function onLoadFileSuccess(message, status, xhr) {
        if (ns.editor == 'textarea') {
            showTextArea(message);
        } else if (ns.editor == 'codemirror') {
            showCodeMirror(message);
        }
        showStatus("Loaded file " + ns.filename);
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
        console.log('parts: [' + parts + ']');
        var app_id = parts.shift();
        var filename = parts.join('/');
        console.log('app_id: [' + app_id + ']');
        if (!app_id) {
            loadAppList();
        } else if (app_id != ns.app_id) {
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
        ns.hash = '###';  // Not initialized, wait for checkHash to update.
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

    // Called when the current user has changed (signed in or out)
    function onUserChange(username) {
        if (username == undefined) {
            $('#username').text('anonymous');
            $('#signin').text('Sign In')
                .attr('href', 'http://www.pageforest.com/sign-in/editor');
        } else {
            $('#username').text(username);
            $('#signin').text('Sign Out')
                .attr('href', 'http://www.pageforest.com/sign-out/editor');
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

    // Exported functions
    ns.extend({
        onReady: onReady,
        onSave: onSave,
        onUserChange: onUserChange,
        onSignInOut: onSignInOut
    });

});
