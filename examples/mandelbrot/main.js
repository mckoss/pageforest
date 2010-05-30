namespace.lookup('com.pageforest.mandelbrot.main').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var mandelbrot = namespace.lookup('com.pageforest.mandelbrot');

    // Initialize the document - create a client helper object
    function onReady() {
        $('#title').focus();
        ns.client = new clientLib.Client(ns);
        ns.client.setLogging(true);
        // Quick call to poll - don't wait a whole second to try loading
        // the doc and logging in the user.
        ns.client.poll();

        var m = new mandelbrot.Mandelbrot();
        var c = document.getElementById('view-port');
        console.log(c.tagName);
        var ctx = c.getContext('2d');
        m.drawTile(ctx, m.xMin, m.yMax,
                   (m.xMax - m.xMin), (m.yMax - m.yMin),
                   0, 0, 512, 512);
    }

    // This function is called whenever your document should be reloaded.
    function setDoc(json) {
    }

    // Convert your current state to JSON with title and blob properties,
    // these will then be saved to pageforest's storage.
    function getDoc() {
        return {
            "title": "My Mandelbrot Location",
            "blob": {x: 0, y: 0},
            "readers": ["public"]
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
        var isSignedIn = ns.client.username != undefined;
        if (isSignedIn) {
            ns.client.signOut();
        }
        else {
            ns.client.signIn();
        }
    }

    function onStateChange(newState, oldState) {
        $('#doc-state').text(newState);
        $('#error').text('');

        // Allow save if doc is dirty OR not bound (yet) to a document.
        if (ns.client.isSaved()) {
            $('#save').attr('disabled', 'disabled');
        }
        else {
            $('#save').removeAttr('disabled');
        }
    }

    // Exported functions
    ns.extend({
        onReady: onReady,
        getDoc: getDoc,
        setDoc: setDoc,
        onError: onError,
        onUserChange: onUserChange,
        onStateChange: onStateChange,
        signInOut: signInOut
    });

});
