namespace.lookup('com.pageforest.auth.sign-in').define(function(ns) {
    /*
      Handle logging a user into Pageforest and optionally also log
      them in to a Pageforest application.

      A logged in use will get a session key on www.pageforest.com.
      This script makes requests to appid.pageforest.com in order to
      get a cookie set on the application domain when the user wants
      to allow the application access to his store.
    */
    var cookies = namespace.lookup('org.startpad.cookies');
    var crypto = namespace.lookup('com.googlecode.crypto-js');

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
    function transferSession(sessionKey) {
        var url = ns.appAuthURL + "set-session/" + sessionKey;
        getJSONP(url, function(message) {
            if (typeof(message) != 'string') {
                return;
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
        // Check for a (session) cookie with the application
        // session key. We clear it once used so it doesn't get
        // retransmitted. This could be used to either sign-in OR
        // sign-out of the application.
        var sessionName = appId + "-sessionkey";
        var appSession = cookies.getCookie(sessionName);
        console.log("appSession: ", appSession);
        if (appSession != undefined) {
            cookies.setCookie(sessionName, 'expired', -1);
            transferSession(appSession);
        }

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

    function onSubmit() {
        // Replace plaintext password with HMAC-SHA1 before POST request.
        var username = $('#id_username').val();
        var password = $('#id_password').val();
        var hmac = crypto.HMAC(crypto.SHA1, username, password);
        $('#id_password').val(hmac);
        $('form#sign-in').submit();
        return true;
    }

    ns.extend({
        onReady: onReady,
        onSubmit: onSubmit,
        transferSession: transferSession
    });

}); // com.pageforest.sign-in
