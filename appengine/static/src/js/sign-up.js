namespace.lookup('com.pageforest.auth.sign-up').define(function(ns) {
    var cookies = namespace.lookup('org.startpad.cookies');
    var crypto = namespace.lookup('com.googlecode.crypto-js');
    var forms = namespace.lookup('com.pageforest.forms');
    var dialog = namespace.lookup('org.startpad.dialog');

    var dlg;

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

    function validateIfChanged() {
        if (!dlg.hasChanged(undefined, true)) {
            return;
        }
        var data = dlg.getValues();
        data.validate = true;
        forms.postFormData('/sign-up/', data,
                           null, onValidateIgnoreEmpty, onError);
    }

    function onSubmit() {
        var errors = validatePassword();
        if (errors) {
            forms.showValidatorResults(['password', 'repeat'], errors);
        } else {
            forms.postFormData('/sign-up/', dlg.getValues(),
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
        dlg = new dialog.Dialog({
            fields: [
                {name: 'username'},
                {name: 'password', type: 'password'},
                {name: 'passwordRepeat', type: 'password', label: "Repeat password"},
                {name: 'email', label: "Email address"},
                {name: 'tos', type: 'checkbox', label: "Terms of Service"},
                {name: 'joinNow', label: "Join Now", type: 'button', onClick: onSubmit}
            ],
            style: dialog.styles.table
        });

        $('#sign-up-dialog').html(dlg.html());
        dlg.setFocus();

        setInterval(validateIfChanged, 1000);
    }

    ns.extend({
        onReady: onReady,
        onSubmit: onSubmit,
        resend: resend
    });

}); // com.pageforest.auth.sign-up
