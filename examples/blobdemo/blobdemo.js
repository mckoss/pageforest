global_namespace.define("com.pageforest.blobdemo", function (ns) {
    var cookies = ns.lookup('org.startpad.cookies');

    ns.documentReady = function() {
        pollCookie();
    };

    function formatResult(xhr, status, message) {
        var result = '';
        if (xhr) {
            result += xhr.status + ' ' + xhr.statusText + ' ';
        }
        if (status) {
            result += status + ' ';
        }
        result += message;
        return result;
    }

    function showSuccess(message, status, xhr) {
        $('#results').prepend('<div style="color:#080">' +
                              formatResult(xhr, status, message) +
                              '</div>');
    }

    function showError(xhr, status, error) {
        $('#results').prepend('<div style="color:#800">' +
                              formatResult(xhr, status, error) +
                              '</div>');
    }

    function signInSuccess(message, status, xhr) {
        // Authentication was successful, we got a new session key.
        showSuccess(message, status, xhr);
        ns.sessionKey = message;
        cookies.setCookie('sessionkey', message);
    }

    function pollCookie() {
        var sessionkey = cookies.getCookie('sessionkey');
        if (sessionkey != undefined)
            showSuccess("Logged in");
        if (ns.polling) {
            clearInterval(ns.polling);
            ns.polling = undefined;
        }
    }

    function newTab(url) {
        var win = window.open(url, '_blank');
        // REVIEW: Why is this needed here?
        if (win && win.focus) {
            win.focus();
        }
    }

    ns.signIn = function () {
        // Open a new tab for the sign-in page.
        var dot = location.host.indexOf('.');
        var www = "www" + location.host.substr(dot);
        var url = "http://" + www + "/sign-in/blobdemo/";
        newTab(url);
        // Start polling for the session key cookie.
        if (ns.polling) {
            clearInterval(ns.polling);
            ns.polling = undefined;
        }
        ns.polling = setInterval(pollCookie, 1000);
    };

    ns.signOut = function () {
        delete ns.sessionKey;
        cookies.setCookie('sessionkey', 'expired', -1);
        showSuccess('deleted session key');
    };

    ns.docAjax = function (method) {
        var doc_id = $("#id_doc_id").val();
        var url = '/docs/' + doc_id + '/';
        var options = {
            type: method,
            dataType: 'text',
            url: url,
            success: showSuccess,
            error: showError
        };
        if (method == "PUT") {
            options.data = $("#id_doc").val();
        }
        $.ajax(options);
    };

    ns.blobAjax = function (method) {
        var doc_id = $("#id_doc_id").val();
        var url = '/docs/' + doc_id + '/' + $("#id_key").val();
        var options = {
            type: method,
            dataType: 'text',
            url: url,
            success: showSuccess,
            error: showError
        };
        if (method == "PUT") {
            options.data = $("#id_value").val();
        }
        $.ajax(options);
    };

}); // com.pageforest.blobdemo
