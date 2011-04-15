namespace.lookup('com.pageforest.auth.sign-up').define(function(exports) {
    var require = namespace.lookup;
    var util = namespace.util;
    var cookies = require('org.startpad.cookies');
    var crypto = require('com.googlecode.crypto-js');
    var forms = require('com.pageforest.forms');
    var dialog = require('org.startpad.dialog');

    exports.extend({
        'onReady': onReady,
        'onSubmit': onSubmit,
        'resend': resend
    });

    var dlg;
    var keyTime;

    function validate(ignoreBlanks) {
        dlg.clearErrors();
        var values = dlg.validate(ignoreBlanks);
        if (values.password != values.repeat) {
            dlg.isValid = false;
            if (!(ignoreBlanks && values.repeat.length == 0)) {
                dlg.setErrors({repeat: "Passwords do not match"});
            }
        }
        if (ignoreBlanks) {
            dlg.postValues('/sign-up/', {
                ignoreBlanks: true,
                extra: {validate: true}
            });
        }
    }

    function validateIfChanged() {
        var time = new Date().getTime();
        // Don't validate while user is actively typing
        if (keyTime == undefined || time - keyTime < 1000) {
            return;
        }
        if (!dlg.hasChanged(undefined, true)) {
            return;
        }
        validate(true);
    }

    function onSubmit() {
        validate();
        if (dlg.isValid) {
            dlg.postValues('/sign-up/', {
                onSucess: function () {
                    window.location = '/sign-in/';
                }
            });
        }
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
                {name: 'username', minSize: 2, required: true},
                {name: 'password', type: 'password', minSize: 6},
                {name: 'repeat', type: 'password', label: "Repeat password"},
                {name: 'email', label: "Email address", required: true},
                {name: 'tos', type: 'checkbox', label: "Terms of Service", required: true},
                {name: 'joinNow', label: "Join Now", type: 'button', onClick: onSubmit}
            ],
            style: dialog.styles.table
        });

        $('#sign-up-dialog').html(dlg.html());
        dlg.bindFields();

        setInterval(validateIfChanged, 1000);
        $(dlg.dlg).keyup(function () {
            keyTime = new Date().getTime();
        });
    }

});
