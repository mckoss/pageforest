namespace.lookup('com.pageforest.scratch').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');

    // Initialize the document
    function onReady() {
        $('#blob').focus();

        // Client library for Pageforest
        ns.client = new clientLib.Client(ns);

        // Use the standard Pageforest UI widget.
        ns.client.addAppBar();

        // Quick call to poll - don't wait a whole second to try loading
        // the doc and logging in the user.
        ns.client.poll();
    }

    // This function is called whenever your document is be reloaded.
    function setDoc(json) {
        $('#blob').val(json.blob);
    }

    // Convert your current state to JSON with blob properties.
    // These will then be saved to pageforest's storage.
    function getDoc() {
        return {
            "blob": $('#blob').val()
        };
    }

    function onStateChange(newState, oldState) {
        // Refresh links on the page
        var url = ns.client.getDocURL();
        var link = $('#document');
        if (url) {
            link.attr('href', url + '?callback=document').show();
        }
        else {
            link.hide();
        }
        $('#mydocs').attr('href', 'http://' + ns.client.wwwHost + '/docs/');
        $('#app-details').attr('href', 'http://' + ns.client.wwwHost +
                               '/apps/' + ns.client.appid);
    }

    // Exported functions
    ns.extend({
        onReady: onReady,
        getDoc: getDoc,
        setDoc: setDoc,
        onStateChange: onStateChange
    });

});
