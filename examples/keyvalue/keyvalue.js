global_namespace.define("com.pageforest.keyvalue", function (ns) {

    var crypto = ns.lookup("com.googlecode.crypto-js");

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

    ns.ajax = function (method) {
        var options = {
            type: method,
            dataType: 'text',
            url: '/docs/doc/' + $("#id_key").val(),
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
            expires = '; expires=' + date.toGMTString();
        }
        path = '; path=' + (path || '/');
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
        $.ajax({
            dataType: 'jsonp',
            url: 'http://auth.' + location.host + '/login/' +
                username + '/' + ns.challenge + '/' + signature,
            success: function (message) {
                ns.sessionKey = message;
                ns.setCookie('sessionkey', message);
                // console.log(document.cookie);
                $('#results').prepend('<div>' + message + '</div>');
            }
        });
    };

    ns.logout = function () {
        delete ns.sessionKey;
        ns.setCookie('sessionkey', 'expired', -1);
        // console.log(document.cookie);
        $('#results').prepend('<div>deleted session key</div>');
    };

}); // com.pageforest.keyvalue
