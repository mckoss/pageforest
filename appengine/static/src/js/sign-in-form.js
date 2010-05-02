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
            ns.getString(ns.appDomain + "/auth/username", function() {
                // We're logged in, clean up and get out.
                ns.closeForm();
            });
        },

        // Send a valid appId sessionKey to the app domain
        // to get it installed on a cookie.
        transferSession: function(sessionKey) {
            ns.getString(ns.appDomain + "/auth/session/" + sessionKey, function () {
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
                success: fn
            });
        },

        // Display success, and close window in 5 seconds.
        closeForm: function() {
            function closeFinal() {
                window.close();
            }
            if (ns.appId)
                $(".have_app").show('slow');
            $(".want_app").hide('slow');
            setTimeout(closeFinal, 5000);
        }

    }); // ns.extend

}); // com.pageforest.sign-in-form
