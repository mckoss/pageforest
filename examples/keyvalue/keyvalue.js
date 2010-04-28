global_namespace.define("com.pageforest.keyvalue", function (ns) {

    var upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var lower = 'abcdefghijklmnopqrstuvwxyz';
    var digits = '0123456789';
    var base64 = upper + lower + digits + '+/';
    var base64url = upper + lower + digits + '-_';

    function randomString(chars, len) {
        var radix = chars.length;
        var uuid = [];
        for (var i = 0; i < len; i++) {
            uuid[i] = chars[0 | Math.random() * radix];
        }
        return uuid.join('');
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

    function reAuthSuccess(xhr, status, message) {
        if (message.__class__ == 'Error') {
            showError(xhr, status, message.message);
            return;
        }
        // Attempt to sign in with a new browser tab.
        ns.authToken = message.token;
        var url = "http://auth.pageforest.com/sign-in/" + ns.authToken;
        ns.newTab(url);
        // Poll the server for the session key.
        pollError(xhr, status, message);
    }

    function poll() {
        if (ns.pollCounter < 20) {
            ns.pollCounter += 1;
            $.ajax({
                url: "/auth/poll/" + ns.token + "?seconds=5",
                error: pollError,
                success: signInSuccess
            });
        }
    }

    function pollError(xhr, status, message) {
        showError(xhr, status, message);
        if (ns.timeout) {
            clearTimeout(ns.timeout);
        }
        ns.timeout = setTimeout(poll, 5000); // Poll again after 5 seconds.
    }

    function signInSuccess(message, status, xhr) {
        // Authentication was successful, we got a new session key.
        showSuccess(message, status, xhr);
        ns.sessionKey = message;
        // ns.setCookie('sessionkey', message);
    }

    ns.signIn = function () {
        ns.token = randomString(base64url, 20);
        var domain = location.host;
        domain = "www" + domain.substr(domain.indexOf('.'));
        var url = "http://" + domain + "/auth/sign-in/" + ns.token;
        ns.newTab(url);
        // Start polling for the session key.
        ns.pollCounter = 0;
        pollError();
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

    ns.newTab = function (url) {
        var win = window.open(url, '_blank');
        if (win && win.focus) {
            win.focus();
        }
    }

}); // com.pageforest.keyvalue
