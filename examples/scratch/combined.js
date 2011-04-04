// Scratch - a sample Pageforest Application
//
// Modify this app as a starting point for own.
/*globals applicationCache */
namespace.lookup('com.pageforest.scratch').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');

    ns.extend({
        'onReady': onReady,
        'getDoc': getDoc,
        'setDoc': setDoc,
        'onStateChange': onStateChange
    });

    function onReady() {
        handleAppCache();
        $('#blob').focus();
        ns.client = new clientLib.Client(ns);
        ns.client.addAppBar();
        ns.client.autoLoad = true;
    }

    // Loading a document
    function setDoc(json) {
        $('#blob').val(json.blob);
    }

    // Saving a document
    function getDoc() {
        return {
            "blob": $('#blob').val()
        };
    }

    // For offline - capable applications
    function handleAppCache() {
        if (typeof applicationCache == 'undefined') {
            return;
        }

        if (applicationCache.status == applicationCache.UPDATEREADY) {
            applicationCache.swapCache();
            location.reload();
            return;
        }

        applicationCache.addEventListener('updateready', handleAppCache, false);
    }

    // Refresh links on the page
    function onStateChange(newState, oldState) {
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

});
