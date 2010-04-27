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

    function successCallback(message, status, xhr) {
        $('#results').prepend('<div style="color:#080">' +
                              formatResult(xhr, status, message) +
                              '</div>');
    }

    function errorCallback(xhr, status, error) {
        $('#results').prepend('<div style="color:#800">' +
                              formatResult(xhr, status, error) +
                              '</div>');
    }

    function verifyCallback(message) {
        if (message.__class__ == 'Error') {
            errorCallback(message, 'Error', message.message);
            return;
        }
        ns.sessionKey = message;
        ns.setCookie('sessionkey', message);
        successCallback(message);
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

    ns.signIn = function () {
    };

    ns.signOut = function () {
        delete ns.sessionKey;
        ns.setCookie('sessionkey', 'expired', -1);
        successCallback('deleted session key');
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
