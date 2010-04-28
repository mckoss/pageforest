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

    function signInSuccess(message, status, xhr) {
        // Authentication was successful, we got a new session key.
        showSuccess(message, status, xhr);
        ns.sessionKey = message;
        ns.setCookie('sessionkey', message);
    }

    function pollCookie() {
        console.log(document.cookie);
    }

    ns.signIn = function () {
        // Open a new tab for the sign-in page.
        ns.token = randomString(base64url, 20);
        var domain = location.host;
        domain = "www" + domain.substr(domain.indexOf('.'));
        var url = "http://" + domain + "/auth/sign-in/" + ns.token;
        ns.newTab(url);
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

    ns.newTab = function (url) {
        var win = window.open(url, '_blank');
        if (win && win.focus) {
            win.focus();
        }
    }

}); // com.pageforest.keyvalue
