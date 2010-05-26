namespace.lookup('com.pageforest.examples.scratch').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var client;

    // Initialize the document - create a client helper object
    function onReady() {
        $('#title').focus();
        ns.client = client = new clientLib.Client(ns);
    }

    // This function is called whenever your document should be reloaded.
    function setData(json) {
        $('#title').val(json.title);
        $('#blob').val(json.blob);
    }

    // Convert your current state to JSON with title and blob properties,
    // these will then be saved to pageforest's storage.
    function getData() {
        return {
            'title': $('#title').val(),
            'blob': $('#blob').val()
        };
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
        var isSignedIn = client.username != undefined;
        if (isSignedIn) {
            client.signOut();
        }
        else {
            client.signIn();
        }
    }

    function onStateChange(newState, oldState) {
        $('#doc-state').text(newState);
        $('#error').text('');

        // Allow save if doc is dirty OR not bound (yet) to a document.
        if (client.isSaved()) {
            $('#save').attr('disabled', 'disabled');
        }
        else {
            $('#save').removeAttr('disabled');
        }

        // Refresh links on the page, too
        var url = client.getDocURL();
        var link = $('#document');
        if (url) {
            link.attr('href', url + '?callback=document').show();
        }
        else {
            link.hide();
        }
        $('#mydocs').attr('href', 'http://' + client.wwwHost + '/docs/');
        $('#app-details').attr('href', 'http://' + client.wwwHost +
                               '/apps/' + client.appid);
    }

    // Exported functions
    ns.extend({
        onReady: onReady,
        getData: getData,
        setData: setData,
        onError: onError,
        onUserChange: onUserChange,
        onStateChange: onStateChange,
        signInOut: signInOut
    });

});
