global_namespace.define("com.pageforest.keyvalue", function (ns) {

    var crypto = ns.import("com.googlecode.crypto-js");

    function formatResult(xhr, status, message) {
        return xhr.status + ' ' + xhr.statusText + ' ' +
            status + ' ' + message;
    }

    function successCallback(message, status, xhr) {
        $('#results').prepend('<div style="color:#080">' +
                              formatResult(xhr, status, message) + '</div>');
    }

    function errorCallback(xhr, status, error) {
        $('#results').prepend('<div style="color:#800">' +
                              formatResult(xhr, status, error) + '</div>');
    }

    function beforeSend(xhr) {
        if (ns.sessionKey) {
            xhr.setRequestHeader("Cookie", "sessionkey=" + ns.sessionKey);
        }
    }

    ns.ajax = function (method) {
        var options = {
            type: method,
            url: '/docs/doc/' + $("#id_key").val(),
            // beforeSend: beforeSend,
            success: successCallback,
            error: errorCallback
        };
        if (method == "PUT") {
            options.data = $("#id_value").val();
        }
        $.ajax(options);
    };

    ns.getChallenge = function () {
        $.ajax({
            dataType: 'jsonp',
            url: 'http://auth.' + location.host + '/challenge',
            success: function (message) {
                $('#results').prepend('<div>' + message + '</div>');
                ns.challenge = message;
            }
        });
    };

    ns.setCookie = function (name, value, days, path) {
        var expires = '';
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
            expires = '; expires=' + date.tomGMTString();
        }
        path = '; path=' + path ? path : '/';
        document.cookie = name + '=' + value + expires + path;
    };

    ns.login = function () {
        if (!ns.challenge) {
            return;
        }
        var username = $('#id_username').val();
        var password = $('#id_password').val();
        var userpass = crypto.HMAC_SHA1(password, username.toLowerCase());
        var signature = crypto.HMAC_SHA1(userpass, ns.challenge);
        var reply = username + '/' + ns.challenge + '/' + signature;
        $.ajax({
            dataType: 'jsonp',
            url: 'http://auth.' + location.host + '/login/' + reply,
            success: function (message) {
                $('#results').prepend('<div>' + message + '</div>');
                ns.sessionKey = message;
                ns.setCookie('sessionkey', ns.sessionKey);
            }
        });
    };

    ns.logout = function () {
        ns.setCookie('sessionkey', 'expired', -1);
        delete ns.sessionKey;
        $('#results').prepend('<div>deleted session key</div>');
    };

}); // com.pageforest.keyvalue
