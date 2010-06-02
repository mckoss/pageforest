namespace.lookup('com.pageforest.registration').define(function(ns) {

    var util = namespace.util;
    var Crypto = namespace.lookup('com.googlecode.crypto-js');

    function onValidateSuccess(message, status, xhr, options) {
        var force = options && options.force;
        var fields = ["username", "password", "email", "tos"];
        for (var index = 0; index < fields.length; index++) {
            var name = fields[index];
            var html = message[name];
            if (!force && $("#id_" + name).val() === '') {
                html = '';
            } else if (html) {
                html = '<span class="error">' + html + '</span>';
            } else {
                html = '<span class="success">OK</span>';
            }
            $("#validate_" + name).html(html);
        }
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
            password: Crypto.HMAC(Crypto.SHA1, username, password),
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

    function validateIfChanged() {
        var data = getFormData();
        data.validate = true;
        var oneline = [data.username, data.email].join('|');
        if (ns.previous != oneline) {
            ns.previous = oneline;
            postFormData(data, onValidateSuccess, onError);
        }
    }

    function onSubmit() {
        var data = getFormData();
        postFormData(data, onSubmitSuccess, onError);
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
    }

    function onReady() {
        ns.previous = '|';
        // Validate in the background
        setInterval(validateIfChanged, 1000);
        $("#id_tos").click(function() {
            $("#validate_tos").html('');
        });
    }

    ns.extend({
        onReady: onReady,
        onSubmit: onSubmit,
        resend: resend
    });

}); // com.pageforest.registration
