namespace.lookup('com.pageforest.main').define(function(ns) {
    var selectedTab;
    var fReadyCalled = false;

    function setTab(name) {
        selectedTab = name || selectedTab;
        if (fReadyCalled && selectedTab) {
            $('#' + selectedTab + '-tab').addClass('selected');
        }
    }

    function onReady() {
        fReadyCalled = true;
        $("input.focus:last").focus();
        setTab();
    }

    ns.extend({
        'onReady': onReady,
        'setTab': setTab
    });
});
