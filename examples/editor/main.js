namespace.lookup('com.pageforest.editor').define(function (ns) {

    function status(message) {
        var lines = $('#status').html().split('<br />\n');
        while (lines.length > 20) {
            lines.pop();
        }
        lines.unshift(message);
        $('#status').html(lines.join('<br />\n'));
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
        var filename = parts.join('/') || 'index.html';
        if (app_id != ns.app_id) {
            ns.loadApp(app_id);
            ns.loadFile(filename);
        } else if (filename != ns.filename) {
            ns.loadFile(filename);
        }
    }

    function loadApp(app_id) {
        ns.app_id = app_id;
        $.ajax({
            url: '/mirror/' + ns.app_id + '?method=list&depth=0',
            dataType: 'json',
            success: function(message) {
                var filenames = [];
                for (var filename in message) {
                    if (message.hasOwnProperty(filename)) {
                        var href = '#' + app_id + '/' + filename;
                        filenames.push(
                            message[filename].size +
                            ' <a href="' + href + '">' + filename + '</a>');
                    }
                }
                $('#navigator').html(filenames.join('<br />\n'));
            }
        });
        status("Loaded app " + ns.app_id);
    }

    function loadFile(filename) {
        ns.filename = filename;
        $.ajax({
            url: '/mirror/' + ns.app_id + '/' + ns.filename,
            dataType: 'text',
            success: function(message) {
                $('div#editor textarea').val(message);
            }
        });
        status("Loaded file " + ns.filename);
    }

    function onReady() {
        ns.hash = '';
        ns.app_id = '';
        ns.filename = '';
        setInterval(checkHash, 300);
    }

    // Called on any api errors.
    function onError(status, message) {
        $('#error').text(message);
    }

    // Called when the current user changes (signs in or out)
    function onUserChange(username) {
        var isSignedIn = username != undefined;
        $('#username').text(isSignedIn ? username : 'anonymous');
        $('#signin').val(isSignedIn ? 'Sign Out' : 'Sign In');
    }

    // Sign in (or out) depending on current user state.
    function signInOut() {
        var isSignedIn = ns.client.username != undefined;
        if (isSignedIn) {
            ns.client.signOut();
        }
        else {
            ns.client.signIn();
        }
    }

    // Exported functions
    ns.extend({
        onReady: onReady,
        loadApp: loadApp,
        loadFile: loadFile,
        onError: onError,
        onUserChange: onUserChange,
        signInOut: signInOut
    });

});
