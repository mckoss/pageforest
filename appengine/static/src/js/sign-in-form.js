global_namespace.define('com.pageforest.auth.sign-in-form', function(ns) {
    ns.extend(ns, {
        // Check if user is already logged in.
        documentReady: function(username, appId) {
            ns.appId = appId;
            ns.appDomain = ns.getAppDomain(appId);

            // Nothing to do until the user signs in - page will reload
            // on form post.
            if (!username)
                return;

            // Just logging in to pageforest - done.
            if (!appId) {
                ns.closeForm();
                return;
            }

            // Check (once) if we're also currently logged in @ appId
            // without having to sign-in again.
            ns.getString(ns.appDomain + "/auth/username", function(username) {
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
            ns.getString(ns.appDomain + "/auth/set-session/" + sessionKey, function (s) {
                if (typeof(s) != 'string') {
                    alert(s.message);
                    return;
                }
                ns.closeForm();
            });
        },

        // www.pf.com -> app.pf.com
        // pf.com -> app.pf.com
        getAppDomain: function(appId) {
            var parts = window.location.host.split('.');
            if (parts[0] == 'www')
                parts[0] = appId;
            else
                parts.splice(0, 0, appId);
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
                    fn({status:500});
                }
            });
        },

        // Display success, and close window in 5 seconds.
        closeForm: function() {
            function closeFinal() {
                // Close the window if we were opened by a cross-site script
                window.close();
            }
            if (ns.appId)
                $(".have_app").show();
            $(".want_app").hide();
            setTimeout(closeFinal, 5000);
        }

    }); // ns.extend

}); // com.pageforest.sign-in-form
