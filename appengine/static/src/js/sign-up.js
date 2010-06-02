namespace.lookup('com.pageforest.auth.sign-up').define(function(ns) {

    var util = namespace.util;
    var cookies = namespace.lookup('org.startpad.cookies');
    var crypto = namespace.lookup('com.googlecode.crypto-js');

    function validatePassword() {
        var password = $("#id_password").val();
        var repeat = $("#id_repeat").val();
        if (!password.length) {
            return {password: "This field is required."};
        }
        if (password.length < 6) {
            return {password:
                    "Ensure this value has at least 6 characters (it has " +
                    password.length + ")."};
        }
        if (password != repeat) {
            return {repeat: "Password and repeat are not the same."};
        }
        return false;
    }

    function showValidatorResults(fields, errors, options) {
        var force = options && options.force;
        for (var index = 0; index < fields.length; index++) {
            var name = fields[index];
            if (name == 'tos' && !force) {
                continue;
            }
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

    function onValidateSuccess(message, status, xhr, options) {
        // Validate password fields on the client side.
        var passwordErrors = validatePassword();
        for (var error in passwordErrors) {
            if (passwordErrors.hasOwnProperty(error)) {
                message[error] = passwordErrors[error];
            }
        }
        showValidatorResults(
            ["username", "password", "repeat", "email", "tos"],
            message, options);
    }

    function onSubmitSuccess(message, status, xhr) {
        if (message.status == 200) {
            document.location = '/sign-in/';
        } else {
            onValidateSuccess(message, status, xhr, {force: true});
        }
    }

    function onError(xhr, status, message) {
        console.error(xhr);
    }

    function getFormData() {
        var username = $("#id_username").val();
        var password = $("#id_password").val();
        var repeat = $("#id_repeat").val();
        return {
            username: username,
            password: crypto.HMAC(crypto.SHA1, username, password),
            email: $("#id_email").val(),
            tos: $("#id_tos").attr('checked') ? 'checked' : ''
        };
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

    function isChanged() {
        var username = $("#id_username").val();
        var password = $("#id_password").val();
        var repeat = $("#id_repeat").val();
        var email = $("#id_email").val();
        var tos = $("#id_tos").attr('checked') ? 'checked' : '';
        var oneline = [username, password, repeat, email, tos].join('|');
        if (oneline == ns.previous) {
            return false;
        }
        ns.previous = oneline;
        return true;
    }

    function validateIfChanged() {
        if (!isChanged()) {
            return;
        }
        var data = getFormData();
        data.validate = true;
        postFormData(data, onValidateSuccess, onError);
    }

    function onSubmit() {
        var errors = validatePassword();
        if (errors) {
            showValidatorResults(['password', 'repeat'], errors,
                                 {force: true});
        } else {
            var data = getFormData();
            postFormData(data, onSubmitSuccess, onError);
        }
        return false;
    }

    // Request a new email verification for the signed in user.
    function resend() {
        console.log("resend");
        $.ajax({
            type: "POST",
            url: "/email-verify/",
            data: {resend: true},
            dataType: "json",
            success: function() {
                $('span#result').css('color', '#0A0')
                    .html("A new verification email was sent.");
            },
            error: function() {
                $('span#result').css('color', '#F00')
                    .html("Sorry, please try again later.");
            }
        });
        return false;
    }

    function onReady() {
        // Hide message about missing JavaScript.
        $('#enablejs').hide();
        // Show message about missing HttpOnly support.
        if (cookies.getCookie('httponly')) {
            $('#httponly').show();
        }

        // Initialize ns.previous to track input changes.
        isChanged();
        // Validate in the background
        setInterval(validateIfChanged, 1000);
        $('#id_tos').click(function() {
            $('#validate_tos').html('');
        });
    }

    ns.extend({
        onReady: onReady,
        onSubmit: onSubmit,
        resend: resend
    });

}); // com.pageforest.sign-up
