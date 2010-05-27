namespace.lookup('com.pageforest.examples.chat').defineOnce(function (ns) {

    // Initialize the document - create a client helper object.
    function onReady() {
        var clientLib = namespace.lookup('com.pageforest.client');
        ns.client = new clientLib.Client(ns);
        ns.client.setLogging(true);
        $('#message').focus();
    }

    // Called on any api errors.
    function onError(status, message) {
        $('#status').text(status + ' ' + message);
    }

    // Called when the current user changes (signs in or out)
    function onUserChange(username) {
        $('#username').text(username ? username : 'anonymous');
        $('#signin').val(username ? 'Sign Out' : 'Sign In');
    }

    // Sign in (or out) depending on current user state.
    function signInOut() {
        if (ns.client.username) {
            ns.client.signOut();
        } else {
            ns.client.signIn();
        }
    }

    // Retrieve the current document state.
    function getDoc() {
        return {
            title: "Public chat",
            blob: "blob", // FIXME optional.
            readers: ["public"],
            writers: ["authenticated"]
        };
    }

    function setDoc(doc) {
        $('#status').html('Entered chatroom ' + JSON.stringify(doc));
    }

    // Create a named chatroom.
    function create() {
        ns.client.save(undefined, $('#docid').val());
    }

    // Send a message to the chat.
    function submit() {
        $.ajax({
            type: 'POST',
            url: '/docs/chat/messages?method=push',
            data: ns.client.username + ': ' + $('#message').val(),
            dataType: 'text',
            success: function(message, status, xhr) {
                $('#status').html(message);
            },
            error: function(xhr, status, message) {
                $('#status').html(status + " " + message);
            }
        });
    }

    // Exported functions
    ns.extend({
        onReady: onReady,
        onError: onError,
        onUserChange: onUserChange,
        signInOut: signInOut,
        getDoc: getDoc,
        setDoc: setDoc,
        create: create,
        submit: submit
    });

});
