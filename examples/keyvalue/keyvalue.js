global_namespace.define("com.pageforest.keyvalue", function (ns) {

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
        ns.setCookie('sessionkey', message);
    }

    function pollCookie() {
        console.log(document.cookie);
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
        var url = "http://" + www + "/auth/sign-in/keyvalue";
        newTab(url);
        // Start polling for the session key cookie.
        if (ns.polling) {
            clearInterval(ns.polling);
        }
        ns.polling = setInterval(pollCookie, 1000);
    };

    ns.signOut = function () {
        delete ns.sessionKey;
        ns.setCookie('sessionkey', 'expired', -1);
        showSuccess('deleted session key');
    };

    ns.ajax = function (method) {
        var options = {
            type: method,
            dataType: 'text',
            url: '/docs/doc/' + $("#id_key").val(),
            success: showSuccess,
            error: showError
        };
        if (method == "PUT") {
            options.data = $("#id_value").val();
        }
        $.ajax(options);
    };

    ns.setCookie = function (name, value, days, path) {
        var expires = '';
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            expires = '; expires=' + date.toGMTString();
        }
        path = '; path=' + (path || '/');
        document.cookie = name + '=' + value + expires + path;
    };

}); // com.pageforest.keyvalue
