namespace.lookup('com.pageforest.editor').define(function (ns) {

    function showStatus(message) {
        var lines = $('#status').html().split('\n');
        while (lines.length > 20) {
            lines.shift();
        }
        lines.push(message + '<br />');
        var div = $('div#status');
        div.html(lines.join('\n'));
        div.attr('scrollTop', div.attr('scrollHeight'));
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

    function loadFile(filename) {
        ns.filename = filename;
        $.ajax({
            url: '/mirror/' + ns.app_id + '/' + ns.filename,
            dataType: 'text',
            success: function(message) {
                ns.codemirror.setCode(message);
                if (filename.substr(-5) == '.html') {
                    ns.codemirror.setParser('HTMLMixedParser');
                } else if (filename.substr(-3) == '.js') {
                    ns.codemirror.setParser('JSParser');
                } else if (filename.substr(-5) == '.json') {
                    ns.codemirror.setParser('JSParser');
                } else if (filename.substr(-4) == '.css') {
                    ns.codemirror.setParser('CSSParser');
                } else {
                    ns.codemirror.setParser('DummyParser');
                }
                ns.codemirror.focus();
                showStatus("Loaded file " + ns.filename);
            },
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
        // Load CodeMirror editor.
        ns.codemirror = CodeMirror.fromTextArea("code", {
            height: "100%",
            path: "codemirror/js/",
            parserfile: [
                "parsexml.js",
                "parsecss.js",
                "tokenizejavascript.js",
                "parsejavascript.js",
                "parsehtmlmixed.js",
                "parsedummy.js"],
            stylesheet: [
                "codemirror/css/xmlcolors.css",
                "codemirror/css/csscolors.css",
                "codemirror/css/jscolors.css"]
        });
        // Start polling for window.location.hash changes.
        setInterval(checkHash, 200);
    }

    // Called when the current user changes (signs in or out)
    function onUserChange(username) {
        var isSignedIn = username != undefined;
        $('#username').text(isSignedIn ? username : 'anonymous');
        $('#signin').val(isSignedIn ? 'Sign Out' : 'Sign In');
    }

    function onClickLoad() {
        window.location.hash = '#' + $('#appid').val();
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
        onClickLoad: onClickLoad,
        onClickSave: onClickSave,
        onClickSignInOut: onClickSignInOut
    });

});
