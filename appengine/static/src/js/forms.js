namespace.lookup('com.pageforest.forms').define(function(ns) {

    function showValidatorResults(fields, errors, options) {
        var force = options && options.force;
        for (var index = 0; index < fields.length; index++) {
            var name = fields[index];
            var html = errors[name];
            if ($("#id_" + name).val() === '' && !force) {
                html = '';
            } else if (html) {
                html = '<span class="error">' + html + '</span>';
            } else {
                html = '<span class="success">OK</span>';
            }
            $("#validate_" + name).html(html);
        }
    }

    function postFormData(data, success, error) {
        $.ajax({
            type: "POST",
            url: "/sign-up/",
            data: data,
            dataType: "json",
            success: success,
            error: error
        });
    }

    ns.extend({
        showValidatorResults: showValidatorResults,
        postFormData: postFormData
    });

}); // com.pageforest.forms
