namespace.lookup('com.pageforest.forms').define(function(ns) {

    function showValidatorResults(fields, errors, options) {
        var ignoreEmpty = options && options.ignoreEmpty;
        for (var index = 0; index < fields.length; index++) {
            var name = fields[index];
            var html = errors[name];
            if (ignoreEmpty && $("#id-" + name).val() === '') {
                html = '';
            } else if (html) {
                html = '<span class="error">' + html + '</span>';
            } else {
                html = '<span class="success">OK</span>';
            }
            $("#validate_" + name).html(html);
        }
    }

    function postFormData(url, data, onSuccess, onValidate, onError) {
        $.ajax({
            type: "POST",
            url: url,
            data: data,
            dataType: "json",
            success: function(message, status, xhr) {
                if (message.status == 200) {
                    if (onSuccess) {
                        onSuccess(message, status, xhr);
                    }
                } else {
                    if (onValidate) {
                        onValidate(message, status, xhr);
                    }
                }
            },
            error: onError
        });
    }

    ns.extend({
        showValidatorResults: showValidatorResults,
        postFormData: postFormData
    });

}); // com.pageforest.forms
