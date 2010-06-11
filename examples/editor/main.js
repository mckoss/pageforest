namespace.lookup('com.pageforest.editor').define(function (ns) {

    function showStatus(message) {
        $('#status').html(message);
    }

    // Called on any api errors.
    function onError(xhr, status, message) {
        showStatus(xhr.status + ' ' + xhr.statusText);
    }

    function loadApp(app_id) {
        ns.app_id = app_id;
        $.ajax({
            url: '/mirror/' + ns.app_id + '?method=list&depth=0',
            dataType: 'json',
            success: function(message) {
                var lines = ['<table>'];
                for (var filename in message) {
                    if (message.hasOwnProperty(filename)) {
                        var href = '#' + app_id + '/' + filename;
                        var link = '<a href="' + href + '">' +
                            filename + '</a>';
                        if (filename == ns.filename) {
                            link = '<b>' + filename + '</b>';
                        }
                        lines.push('<tr>' +
                                   '<td class="quiet right">' +
                                   message[filename].size + '</td>' +
                                   '<td>' + link + '</td>' +
                                   '</tr>');
                    }
                }
                lines.push('</table>');
                $('#navigator').html(lines.join('\n'));
            },
            error: onError
        });
    }

    function onLoadFileSuccess(message, status, xhr) {
        if (ns.codemirror == undefined) {
            $('#code').val(message).focus();
            return;
        }
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
        showStatus("Loaded file " + ns.filename);
    }

    function loadFile(filename) {
        ns.filename = filename;
        $.ajax({
            url: '/mirror/' + ns.app_id + '/' + ns.filename,
            dataType: 'text',
            success: onLoadFileSuccess,
            error: onError
        });
    }

    function checkHash() {
        var hash = window.location.hash;
        if (hash == ns.hash) {
            return;
        }
        ns.hash = hash;
        // Split hash into app_id and filename.
        var parts = hash.substr(1).split('/');
        var app_id = parts.shift();
        loadApp(app_id);
        var filename = parts.join('/') || 'app.json';
        loadFile(filename);
    }

    function onReady() {
        var clientLib = namespace.lookup('com.pageforest.client');
        ns.client = new clientLib.Client(ns);
        ns.client.saveInterval = 0;  // Turn off auto-save.
        ns.hash = '';
        ns.app_id = '';
        ns.filename = '';
        // Start polling for window.location.hash changes.
        setInterval(checkHash, 200);
    }

    // Convert textarea to CodeMirror editor with syntax highlighting.
    function onClickCodeMirror() {
        ns.codemirror = window.CodeMirror.fromTextArea("code", {
            height: "100%",
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

    function onClickSave() {
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
    function onClickSignInOut() {
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
        onChangeFilename: onChangeFilename,
        onClickSave: onClickSave,
        onClickSignInOut: onClickSignInOut,
        onClickCodeMirror: onClickCodeMirror
    });

});
