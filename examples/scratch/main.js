namespace.lookup('com.pageforest.examples.scratch').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var client;

    // Initialize the document - create a client helper object
    function onReady() {
        $('#title').focus();
        ns.client = client = new clientLib.Client(ns);
        client.setLogging();
    }

    // This function is called whenever your document should be reloaded.
    function setData(json) {
        $('#title').val(json.title);
        $('#blob').val(json.blob);
        ns.updateStatus("Loaded.");
    }

    // Convert your current state to JSON with title and blob properties,
    // these will then be saved to pageforest's storage.
    function getData() {
        var json = {
            'title': $('#title').val(),
            'blob': $('#blob').val()
        };
        return json;
    }

    // Display a status message for the most recent activity.
    function updateStatus(message) {
        $('#results').prepend('<div>' + message +
                              ' (document is ' +
                              clientLib.Client.states.getName(client.state) +
                              ')' +
                              '</div>');

        // Refresh links on the page, too
        $('#document').attr('href', client.getDocURL() + '?callback=document');
        $('#mydocs').attr('href', 'http://' + client.wwwHost + '/docs/');
        $('#app-details').attr('href', 'http://' + client.wwwHost +
                               '/apps/' + client.appid);
    }

    // Called when our save is successful.
    function onSaveSuccess() {
        updateStatus("Saved.");
    }

    // Called on any api errors.
    function onError(status, message) {
        updateStatus(status + ": " + message);
    }

    // Called when the current user changes (signs in or out)
    function onUserChange(username) {
        $('#username').text(username);
        var isSignedIn = username != 'anonymous';
        $('#signin').attr('disabled', isSignedIn);
        $('#signout').attr('disabled', !isSignedIn);
    }

    function onStateChange(newState, oldState) {
        $('#doc-state').html(clientLib.Client.states.getName(newState));
    }

    // Exported functions
    ns.extend({
        onReady: onReady,
        updateStatus: updateStatus,
        getData: getData,
        setData: setData,
        onSaveSuccess: onSaveSuccess,
        onError: onError,
        onUserChange: onUserChange,
        onStateChange: onStateChange
    });

});
