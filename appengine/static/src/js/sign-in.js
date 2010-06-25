/*
  Handle logging a user into Pageforest and optionally also log them
  in to a Pageforest application.

  A logged in use will get a session key on www.pageforest.com. This
  script makes requests to appid.pageforest.com in order to get a
  cookie set on the application domain when the user wants to allow
  the application access to his store.
*/

namespace.lookup('com.pageforest.auth.sign-in').define(function(ns) {

    var cookies = namespace.lookup('org.startpad.cookies');
    var crypto = namespace.lookup('com.googlecode.crypto-js');
    var forms = namespace.lookup('com.pageforest.forms');

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
            error: function() {
                fn({status: 500});
            }
        });
    }

    // Display success, and close window in 5 seconds.
    function closeForm() {
        if (ns.appId) {
            $(".have_app").show();
        }
        $(".want_app").hide();
        setTimeout(window.close, 2000);
    }

    // Send a valid appId sessionKey to the app domain
    // to get it installed on a cookie.
    function transferSession(sessionKey, fn) {
        var url = ns.appAuthURL + "set-session/" + sessionKey;
        getJSONP(url, function(message) {
            if (typeof(message) != 'string') {
                return;
            }
            if (fn) {
                fn();
            }

            // Close the window if this was used to
            // sign in to the app.
            if (sessionKey) {
                closeForm();
            }
        });
    }

    // Check if user is already logged in.
    function onReady(username, appId) {
        // Hide message about missing JavaScript.
        $('#enablejs').hide();
        // Show message about missing HttpOnly support.
        if (cookies.getCookie('httponly')) {
            $('#httponly').show();
        }

        ns.appId = appId;
        ns.appAuthURL = 'http://' + getAppDomain(appId) + '/auth/';

        // Nothing to do until the user signs in - page will reload
        // on form post.
        if (!username) {
            return;
        }

        // Just logging in to pageforest - done.
        if (!appId) {
            closeForm();
            return;
        }

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

    function onSuccess(message, status, xhr) {
        if (message.sessionKey) {
            transferSession(message.sessionKey, function() {
                window.location.reload();
            });
            return;
        }
        window.location.reload();
    }

    function onValidate(message, status, xhr) {
        forms.showValidatorResults(['username', 'password'], message);
    }

    function onError(xhr, status, message) {
        console.error(status + ': ' + message);
    }

    function onSubmit() {
        var username = $('#id_username').val();
        var lower = username.toLowerCase();
        var password = $('#id_password').val();
        var data = {
            username: username,
            password: crypto.HMAC(crypto.SHA1, lower, password),
            appauth: $('#id_appauth').attr('checked') ? 'checked' : ''
        };
        forms.postFormData(window.location.pathname, data,
                           onSuccess, onValidate, onError);
        return false;
    }

    function signOut() {
        if (ns.appId) {
            transferSession('expired', function() {
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
        'signOut': signOut
    });

}); // com.pageforest.auth.sign-in
