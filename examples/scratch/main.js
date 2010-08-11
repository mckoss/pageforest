namespace.lookup('com.pageforest.scratch').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');

    // Initialize the document - create a client helper object
    function onReady() {
        $('#title').focus();
        ns.client = new clientLib.Client(ns);
        ns.client.addAppBar();
        // Quick call to poll - don't wait a whole second to try loading
        // the doc and logging in the user.
        ns.client.poll();
    }

    // This function is called whenever your document should be reloaded.
    function setDoc(json) {
        $('#title').val(json.title);
        $('#blob').val(json.blob);
    }

    // Convert your current state to JSON with title and blob properties,
    // these will then be saved to pageforest's storage.
    function getDoc() {
        return {
            "title": $('#title').val(),
            "blob": $('#blob').val(),
            "readers": ["public"]
        };
    }

    function onStateChange(newState, oldState) {
        // Refresh links on the page, too
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
