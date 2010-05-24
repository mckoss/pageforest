namespace.lookup('com.pageforest.auth.sign-in-form').define(function(ns) {
    /*
      Handle logging a user into Pageforest and optionally also log
      them in to a Pageforest application.

      A logged in use will get a session key on www.pageforest.com.
      This script makes requests to appid.pageforest.com in order to
      get a cookie set on the application domain when the user wants
      to allow the application access to his store.
    */
    var cookies = namespace.lookup('org.startpad.cookies');

    ns.extend({
        // Check if user is already logged in.
        documentReady: function(username, appId) {
            ns.appId = appId;
            ns.appAuthURL = ns.getAppDomain(appId) + '/auth/';

            // Check for a (session) cookie with the application
            // session key. We clear it once used so it doesn't get
            // retransmitted. This could be used to either sign-in OR
            // sign-out of the application.
            var sessionName = appId + "-sessionkey";
            var appSession = cookies.getCookies()[sessionName];
            console.log("appSession: ", appSession);
            if (appSession != undefined) {
                cookies.setCookie(sessionName, 'expired', -1);
                ns.transferSession(appSession);
            }

            // Nothing to do until the user signs in - page will reload
            // on form post.
            if (!username) {
                return;
            }

            // Just logging in to pageforest - done.
            if (!appId) {
                ns.closeForm();
                return;
            }


            // Check (once) if we're also currently logged in @ appId
            // without having to sign-in again.
            // REVIEW: Isn't this insecure?
            ns.getString(ns.appAuthURL + "username/", function(username) {
                // We're already logged in!
                if (typeof(username) == 'string') {
                    ns.closeForm();
                    return;
                }
            });
        },

        transferSession: function(sessionKey) {
            // Send a valid appId sessionKey to the app domain
            // to get it installed on a cookie.
            var url = ns.appAuthURL + "set-session/" + sessionKey;
            ns.getString(url, function (s) {
                if (typeof(s) != 'string') {
                    return;
                }
                // Close the window if this was used to
                // sign in to the app.
                if (sessionKey) {
                    ns.closeForm();
                }
            });
        },

        // www.pageforest.com -> app.pageforest.com
        // pageforest.com -> app.pageforest.com
        getAppDomain: function(appId) {
            var parts = window.location.host.split('.');
            if (parts[0] == 'www') {
                parts[0] = appId;
            }
            else {
                parts.splice(0, 0, appId);
            }
            return parts.join('.');
        },

        // Use JSONP to read the username from the cross-site application.
        getString: function(url, fn) {
            url = "http://" + url;
            $.ajax({
                type: "GET",
                url: url,
                dataType: "jsonp",
                success: fn,
                error: function() {
                    fn({status: 500});
                }
            });
        },

        // Display success, and close window in 5 seconds.
        closeForm: function() {
            function closeFinal() {
                // Close the window if we were opened by a cross-site script
                window.close();
            }
            if (ns.appId) {
                $(".have_app").show();
            }
            $(".want_app").hide();
            setTimeout(closeFinal, 2000);
        }

    }); // ns.extend

}); // com.pageforest.sign-in-form
