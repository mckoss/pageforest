/*
  Handle logging a user into Pageforest and optionally also log them
  in to a Pageforest application.

  A logged in user will get a cookie on www.pageforest.com. This
  script makes requests to appid.pageforest.com in order to get a
  cookie set on the application domain when the user wants to allow
  the application access to his pageforest account.
*/

namespace.lookup('com.pageforest.auth.sign-in').define(function(ns) {
    var main = namespace.lookup('com.pageforest.main');
    var cookies = namespace.lookup('org.startpad.cookies');
    var crypto = namespace.lookup('com.googlecode.crypto-js');
    var forms = namespace.lookup('com.pageforest.forms');
    var dom = namespace.lookup('org.startpad.dom');
    var dialog = namespace.lookup('org.startpad.dialog');

    var appId;
    var appAuthURL;
    var sessionKey;
    var dlg;

    // www.pageforest.com -> app.pageforest.com
    // pageforest.com -> app.pageforest.com
    function getAppDomain(appId) {
        var parts = window.location.host.split('.');
        if (parts[0] == 'www') {
            parts[0] = appId;
        } else {
            parts.splice(0, 0, appId);
        }
        return parts.join('.');
    }

    // Use JSONP to read the username from the cross-site application.
    function getJSONP(url, fn) {
        $.ajax({
            type: "GET",
            url: url,
            dataType: "jsonp",
            success: fn,
            // We return a 404 for the jsonP - when can trigger this error
            // Review: would be better to tunnel all results at 200 with
            // embedded error status.
            error: function() {
                fn({status: 500});
            }
        });
    }

    // Display success, and close window in 2 seconds.
    function closeForm() {
        $(document.body)[appId ? 'addClass' : 'removeClass']('app');
        setTimeout(window.close, 2000);
    }

    function getSessionKey(fn) {
        fn = fn || function () {};
        if (!appId || sessionKey) {
            fn();
            return;
        }
        $.getJSON('/get-session-key/' + appId, function (json) {
            if (json.status != 200) {
                $('#error').text = json.statusText;
                return;
            }
            $(document.body).addClass('session');
            sessionKey = json.sessionKey;
            fn();
        });
    }

    // Send a valid appId sessionKey to the app domain
    // to get it installed on a cookie.
    function transferSessionKey(fn) {
        fn = fn || function () {};
        if (!appAuthURL) {
            fn();
            return;
        }
        var url = appAuthURL + "set-session/" + sessionKey;
        getJSONP(url, function(message) {
            if (typeof(message) != 'string') {
                return;
            }
            $(document.body).removeClass('session');
            if (fn) {
                fn();
            }
        });
        return false;
    }

    function onSuccess(message, status, xhr) {
        $(document.body).addClass('user');
        $('.username').text(dlg.values.username);
        getSessionKey(function () {
            if (dlg.values.allowAccess) {
                transferSessionKey(closeForm);
            }
        });
    }

    function onError(xhr, status, message) {
        var text = xhr.responseText;
        if (text.substr(0, 19) == 'Invalid signature: ') {
            text = text.substr(19);
        }
        if (/(user|account)/i.test(text)) {
            forms.showValidatorResults(
                ['username', 'password'], {username: text, password: ' '});
        } else {
            forms.showValidatorResults(
                ['username', 'password'], {password: text});
        }
    }

    function onChallenge(challenge, status, xhr) {
        var userpass = crypto.HMAC(crypto.SHA1, dlg.values.username, dlg.values.password);
        var signature = crypto.HMAC(crypto.SHA1, challenge, userpass);
        var reply = dlg.values.username + '|' + challenge + '|' + signature;
        $.ajax({
            url: '/auth/verify/' + reply,
            success: onSuccess,
            error: onError
        });
    }

    function onSubmit() {
        dlg.values = dlg.getValues();
        dlg.values.username = dlg.values.username.toLowerCase();

        $.ajax({
            url: '/auth/challenge',
            success: onChallenge,
            error: onError
        });
        return false;
    }

    function onReady(forApp) {
        var username = cookies.getCookie('sessionuser');
        appId = forApp;

        dlg = new dialog.Dialog({
            fields: [
                {name: 'username'},
                {name: 'password', type: 'password'},
                {name: 'allowAccess', label: "Allow Access to " + appId, type: 'checkbox'},
                {name: 'signIn', label: "Sign In", type: 'button', onClick: onSubmit}
            ],
            style: dialog.styles.table
        });

        if (appId) {
            appAuthURL = 'http://' + getAppDomain(appId) + '/auth/';
        } else {
            dlg.showField('allowAccess', false);
        }

        $('#sign-in-dialog').html(dlg.html());
        dlg.setFocus();

        // Nothing to do until the user signs in - page will reload
        // on form post.
        if (appId) {
            $(document.body).addClass('app');
        }

        if (username) {
            $(document.body).addClass('user');
            $('.username').text(username);
            getSessionKey();
        }
    }

    function signOut() {
        if (appId) {
            sessionKey = 'expired';
            transferSessionKey(function() {
                window.location = '/sign-out/' + appId;
            });
            return;
        }
        window.location = '/sign-out/';
    }

    ns.extend({
        'onReady': onReady,
        'onSubmit': onSubmit,
        'transferSessionKey': transferSessionKey,
        'signOut': signOut,
        'closeForm': closeForm
    });

}); // com.pageforest.auth.sign-in
