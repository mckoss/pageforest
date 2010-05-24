namespace.lookup('com.pageforest.examples.scratch').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var client;

    // Initialize the document - create a client helper object
    function onReady() {
        ns.client = client = new clientLib.Client(ns);
        client.setLogging();
    }

    // Update the link to the current document for the UI
    function updateDocLink() {
        $('#document').attr('href', client.getDocURL() + '?callback=document');
        $('#mydocs').attr('href', 'http://' + client.wwwHost + '/docs/');
        $('#app-details').attr('href', 'http://' + client.wwwHost +
                               '/apps/' + client.appid);
    }

    // Display a status message for the most recent activity.
    function updateStatus(message) {
        $('#results').prepend('<div>' + message +
                              ' (' +
                              clientLib.Client.states.getName(client.state) +
                              ')' +
                              '</div>');
    }

    // This function is called whenever your document should be reloaded.
    function onLoad(json) {
        $('#title').val(json.title);
        $('#blob').val(json.blob);
        updateDocLink();
        updateStatus("Loaded.");
    }

    // Convert your current state to JSON with title and blob properties,
    // these will then be saved to pageforest's storage.
    function onSave() {
        var json = {
            'title': $('#title').val(),
            'blob': $('#blob').val()
        };
        return json;
    }

    // Called when our save is successful.
    function onSaveSuccess() {
        updateDocLink();
        updateStatus("Saved.");
    }

    // Called on any api errors.
    function onError(status, message) {
        updateStatus(status + ": " + message);
    }

    // Called when the current user changes (signs in or out)
    function onUserChanged(username) {
        $('#username').text(username);
        var isSignedIn = username != 'anonymous';
        $('#signin').attr('disabled', isSignedIn);
        $('#signout').attr('disabled', !isSignedIn);
    }

    // Exported functions
    ns.extend({
        onReady: onReady,
        onLoad: onLoad,
        onSave: onSave,
        onSaveSuccess: onSaveSuccess,
        onError: onError,
        onUserChanged: onUserChanged
    });

});
