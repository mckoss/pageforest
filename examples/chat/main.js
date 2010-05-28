namespace.lookup('com.pageforest.examples.chat').defineOnce(function (ns) {

    // Long polling for new chat messages from remote users.
    function poll(wait) {
        if (!ns.client.docid) {
            return; // We have not entered a chatroom yet.
        }
        if (ns.xhr) {
            return; // The previous poll is still in progress.
        }
        ns.xhr = $.ajax({
            url: '/docs/' + ns.client.docid +
                '/messages?wait=' + wait + '&slice=-50:',
            dataType: 'json',
            success: function(history, status, xhr) {
                var textarea = $('#messages');
                textarea.val(history.join('\n'));
                textarea.attr('scrollTop', textarea.attr('scrollHeight'));
            },
            complete: function() {
                ns.xhr = false;
            }
        });
    }

    function comet() {
        poll(20);
    }

    // Initialize the document - create a client helper object.
    function onReady() {
        var clientLib = namespace.lookup('com.pageforest.client');
        ns.client = new clientLib.Client(ns);
        ns.client.setLogging(true);
        $('#docid').focus();
        // Start a new long poll request whenever necessary.
        setInterval(comet, 1000);
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

    // Respond to document load success.
    function setDoc(doc) {
        $('#status').html('Joined chatroom: ' + ns.client.docid);
        poll(0);
    }

    // Join a chatroom by name.
    // This creates the chatroom if it didn't exist already.
    function join() {
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
        $('#message').val('');
        $('#message').focus();
    }

    // Exported functions
    ns.extend({
        onReady: onReady,
        onError: onError,
        onUserChange: onUserChange,
        signInOut: signInOut,
        getDoc: getDoc,
        setDoc: setDoc,
        join: join,
        submit: submit
    });

});
