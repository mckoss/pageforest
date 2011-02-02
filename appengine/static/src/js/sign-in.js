/*
  Handle logging a user into Pageforest and optionally also log them
  in to a Pageforest application.

  A logged in user will get a cookie on www.pageforest.com. This
  script makes requests to appid.pageforest.com in order to get a
  cookie set on the application domain when the user wants to allow
  the application access to his pageforest account.
*/

namespace.lookup('com.pageforest.auth.sign-in').define(function(ns) {
    var cookies = namespace.lookup('org.startpad.cookies');
    var crypto = namespace.lookup('com.googlecode.crypto-js');
    var forms = namespace.lookup('com.pageforest.forms');
    var dom = namespace.lookup('com.pageforest.dom');

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
        $(document.body)[ns.appId ? 'addClass' : 'removeClass']('app');
        setTimeout(window.close, 2000);
    }

    // Send a valid appId sessionKey to the app domain
    // to get it installed on a cookie.
    function transferSession(fn) {
        if (!ns.appAuthURL) {
            if (fn) {
                fn();
            }
            return;
        }
        var url = ns.appAuthURL + "set-session/" + ns.sessionKey;
        getJSONP(url, function(message) {
            if (typeof(message) != 'string') {
                return;
            }
            if (fn) {
                fn();
            }
        });
        return false;
    }

    function onSuccess(message, status, xhr) {
        ns.sessionKey = message;
        transferSession(function() {
            window.location.reload();
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
        var username = $('#id_username').val();
        var lower = username.toLowerCase();
        var password = $('#id_password').val();
        var userpass = crypto.HMAC(crypto.SHA1, lower, password);
        var signature = crypto.HMAC(crypto.SHA1, challenge, userpass);
        var reply = lower + '|' + challenge + '|' + signature;
        $.ajax({
            url: '/auth/verify/' + reply,
            success: onSuccess,
            error: onError
        });
    }

    function onSubmit() {
        $.ajax({
            url: '/auth/challenge',
            success: onChallenge,
            error: onError
        });
        return false;
    }

    // Check if user is already logged in.
    function onReady(username, appId, sessionKey) {
        ns.appId = appId;
        ns.sessionKey = sessionKey;
        if (appId) {
            ns.appAuthURL = 'http://' + getAppDomain(appId) + '/auth/';
        }

        // Nothing to do until the user signs in - page will reload
        // on form post.
        $(document.body)[username ? 'addClass' : 'removeClass']('user');
        $(document.body)[appId ? 'addClass' : 'removeClass']('app');

        if (appId) {
            // Check (once) if we're also currently logged in @ appId
            // without having to sign-in again.
            // REVIEW: Isn't this insecure?
            var url = ns.appAuthURL + "username/";
            getJSONP(url, function(username) {
                // We're already logged in!
                if (typeof(username) == 'string') {
                    closeForm();
                    return;
                }
            });
        }
    }

    function signOut() {
        if (ns.appId) {
            ns.sessionKey = 'expired';
            transferSession(function() {
                window.location = '/sign-out/' + ns.appId;
            });
            return;
        }
        window.location = '/sign-out/';
    }

    ns.extend({
        'onReady': onReady,
        'onSubmit': onSubmit,
        'transferSession': transferSession,
        'signOut': signOut,
        'closeForm': closeForm
    });

}); // com.pageforest.auth.sign-in
