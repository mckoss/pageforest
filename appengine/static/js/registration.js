global_namespace.define('com.pageforest.registration', function(ns) {

    function html_message(name, message) {
        if ($("#id_" + name).val() === '') {
            return '';
        }
        if (message) {
            return '<span class="error">' + message + '</span>';
        }
        return '<span class="success">OK</span>';
    }

    function validate_success(message, status, xhr) {
        var fields = {"username": "username", "email": "email",
                      "password": "password", "repeat": "__all__"};
        for (var name in fields) {
            if (ns.isOwn(fields, name)) {
                $("#validate_" + name).html(
                    html_message(name, message[fields[name]]));
            }
        }
    }

    function validate_error(xhr, status, message) {
        console.error(xhr);
    }

    function validate_if_changed() {
        var data = {
            username: $("#id_username").val(),
            email: $("#id_email").val(),
            password: $("#id_password").val(),
            repeat: $("#id_repeat").val(),
            tos: true
        };
        var oneline = [data.username, data.email,
                       data.password, data.repeat];
        oneline = oneline.join('~');
        if (oneline == ns.previous) {
            return;
        }
        ns.previous = oneline;
        console.log(oneline);
        $.ajax({
            type: "POST",
            url: "/auth/register/validate/",
            data: data,
            dataType: "json",
            success: validate_success,
            error: validate_error
        });
    }

    ns.document_ready = function () {
        ns.previous = '~~~';
        setInterval(validate_if_changed, 1000);  // Once per second.
    };

}); // com.pageforest.registration
