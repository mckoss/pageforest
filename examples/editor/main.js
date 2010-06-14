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

    function listFiles(directory) {
        var html = [];
        html.push('<table>');
        html.push('<tr>' +
                  '<th>Filename</th>' +
                  '<th>Size</th>' +
                  '<th>Modified</th>' +
                  '</tr>');
        for (var path in ns.listing) {
            if (ns.listing.hasOwnProperty(path)) {
                var parts = path.split('/');
                var filename = parts.pop();
                if (parts.join('/') == directory) {
                    var href = '#' + ns.app_id + '/' + directory;
                    if (href.substr(-1) != '/') {
                        href += '/';
                    }
                    href += filename;
                    html.push(
'<tr>' +
'<td><a href="' + href + '">' + filename + '</a></td>' +
'<td>' + ns.listing[path].size + '</td>' +
'<td>' + ns.listing[path].modified.isoformat + '</td>' +
'</tr>');
                }
            }
        }
        html.push('</table>');
        return html.join('\n');
    }

    function updateOpenDialog() {
        var html = [];
        var directories = keys(ns.directories);
        directories.sort();
        directories.forEach(function (directory) {
            html.push('<a href="#' + ns.app_id + '/' + directory + '/">' +
                      (directory || 'top') + '</a>');
        });
        var filenames = ns.directories[ns.directory || ''];
        filenames.forEach(function(filename) {
            html.push('<option value="' + filename + '">' +
                         filename + '</option>');
        });
        $('#filename').html(html.join('\n'));
    }

    function extractDirectories(message) {
        ns.directories = {};
        for (var path in message) {
            if (message.hasOwnProperty(path)) {
                var parts = path.split('/');
                var filename = path.pop();
                var directory = path.join('/');
                if (ns.directories.hasOwnProperty(directory)) {
                    ns.directories[directory].push(filename);
                } else {
                    ns.directories[directory] = [filename];
                }
            }
        }
    }

    function onListSuccess(message, status, xhr) {
        ns.listing = message;
        $('#listing').html(listFiles(ns.directory || ''));
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
        while (scrollHeight == offsetHeight) {
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
    }

    function loadFile(filename) {
        ns.filename = filename;
        if (filename.substr(-1) == '/') {
            $.ajax({
                url: '/mirror/' + ns.app_id + '/' + ns.filename +
                    '?method=list&depth=0&keysonly=true',
                dataType: 'text',
                success: onLoadFileSuccess,
                error: onError
            });
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
        var filename = parts.join('/') || 'app.json';
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
        ns.hash = '';
        ns.app_id = '';
        ns.filename = '';
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
