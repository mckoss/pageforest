namespace.lookup('com.pageforest.auth.sign-up').define(function(ns) {

    var cookies = namespace.lookup('org.startpad.cookies');
    var crypto = namespace.lookup('com.googlecode.crypto-js');
    var forms = namespace.lookup('com.pageforest.forms');

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

    function onValidate(message, status, xhr, options) {
        // Validate password fields on the client side.
        var passwordErrors = validatePassword();
        for (var error in passwordErrors) {
            if (passwordErrors.hasOwnProperty(error)) {
                message[error] = passwordErrors[error];
            }
        }
        var fields = ['username', 'password', 'repeat', 'email'];
        if (!options || !options.ignoreEmpty) {
            fields.push('tos');
        }
        forms.showValidatorResults(fields, message, options);
    }

    function onValidateIgnoreEmpty(message, status, xhr) {
        onValidate(message, status, xhr, {ignoreEmpty: true});
    }

    function onSuccess(message, status, xhr) {
        window.location = '/sign-in/';
    }

    function onError(xhr, status, message) {
        console.error(xhr);
    }

    function getFormData() {
        var username = $("#id_username").val();
        var lower = username.toLowerCase();
        var password = $("#id_password").val();
        return {
            username: username,
            password: crypto.HMAC(crypto.SHA1, lower, password),
            email: $("#id_email").val(),
            tos: $("#id_tos").attr('checked') ? 'checked' : ''
        };
    }

    function isChanged() {
        var username = $("#id_username").val();
        var password = $("#id_password").val();
        var repeat = $("#id_repeat").val();
        var email = $("#id_email").val();
        var oneline = [username, password, repeat, email].join('|');
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
        forms.postFormData('/sign-up/', data,
                           null, onValidateIgnoreEmpty, onError);
    }

    function onSubmit() {
        var errors = validatePassword();
        if (errors) {
            forms.showValidatorResults(['password', 'repeat'], errors);
        } else {
            forms.postFormData('/sign-up/', getFormData(),
                               onSuccess, onValidate, onError);
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

}); // com.pageforest.auth.sign-up
