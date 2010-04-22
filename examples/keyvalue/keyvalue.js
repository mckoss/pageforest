global_namespace.define("com.pageforest.keyvalue", function(ns) {

    function formatResult(xhr, status, message) {
        return xhr.status + ' ' + xhr.statusText + ' ' +
            status + ' ' + message + ' ' +
            xhr.getResponseHeader("X-Echo");
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
        xhr.setRequestHeader("X-Hello", "Good morning");
    }

    ns.ajax = function(method) {
        options = {
            type: method,
            url: '/docs/doc/' + $("#id_key").val(),
            beforeSend: beforeSend,
            success: successCallback,
            error: errorCallback,
        };
        if (method == "PUT") options.data = $("#id_value").val();
        $.ajax(options);
    };

}); // com.pageforest.keyvalue
