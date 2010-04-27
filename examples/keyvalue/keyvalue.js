global_namespace.define("com.pageforest.keyvalue", function (ns) {

    var crypto = ns.lookup("com.googlecode.crypto-js");

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

    function reAuthError(xhr, status, message) {
        if (xhr.status != 403) {
            showError(xhr, status, message);
            return;
        }
        // Attempt to sign in with a new browser tab.
        ns.authToken = message.token;
        var url = "http://auth.pageforest.com/sign-in/" + ns.authToken;
        var win = window.open(url, '_blank');
        if (win && win.focus) {
            win.focus();
        }
        // Poll the server for the session key.
        pollError(xhr, status, message);
    }

    function pollError(xhr, status, message) {
        showError(xhr, status, message);
        $.ajax({
            url: "/auth/poll/" + ns.authToken,
            error: pollError,
            success: signInSuccess
        });
    }

    ns.signIn = function () {
        $.ajax({
            url: "/auth/reauth",
            success: signInSuccess,
            error: reAuthError,
        });
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
