/*
  client.js - Pageforest client api for sign in, save, load, and url
  management.

  Requires jQuery.

  TODO: This client assumes the app is hosted at appid.pageforest.com.
  It needs to be modified to support remote hosting and local filesystem
  testing.
 */
namespace.lookup('com.pageforest.client').defineOnce(function (ns) {
    var cookies = namespace.lookup('com.pageforest.cookies');
    var base = namespace.lookup('org.startpad.base');

    var pollInterval = 500;
    var states = new base.Enum('clean', 'dirty', 'loading', 'saving');

    var lastHash;

    // The application calls Client, and implements the following methods:
    // app.loaded(jsonDocument) - Called when a new document is loaded
    // app.error(errorMessage) - Called when we get an error reading or
    //     writing a document (optional).
    // app.userChanged(username) - Called when the user signs in or signs out
    //     ('anonymous').
    // app.saved() - successfully saved
    function Client(app) {
        this.app = app;

        // TODO: Support remote and local filesytem hosting.
        var dot = location.host.indexOf('.');
        this.appid = location.host.substr(0, dot);
        this.wwwHost = 'www' + location.host.substr(dot);

        this.lastHash = '';
        this.state = states.clean;
        this.username = undefined;

        var www = "www" + location.host.substr(dot);

        // REVIEW: When we support multiple clients per page, we can
        // combine all the poll functions into a shared one.
        setInterval(this.poll.fnMethod(this), pollInterval);

        // Catch window unload if the user tries to close an unsaved window
        $(window).bind('beforeunload', this.beforeUnload.fnMethod(this));
    }

    Client.methods({
        // Load a document
        load: function (docid) {
            // REVIEW: What to do if already in loading or saving state?
            this.state = states.loading;
            this.docid = docid;
            $.ajax({
                dataType: 'json',
                url: this.host + '/docs/' + docid,
                error: this.errorHandler.fnMethod(this),
                success: function (document, textStatus, xmlhttp) {
                    this.state = states.idle;
                    this.app.loaded(document);
                }
            });
        },

        save: function (docid) {
            if (docid != undefined) {
                this.docid = docid;
            }
            this.state = states.saving;

            // TODO: If this is a first save, generate a default docid
            // using username_N pattern.
            var data = JSON.stringify({
                title: $('#title').val(),
                blob: $('#blob').val(),
                readers: ['public']
            });
            var docId = $('#name').val();
            $.ajax({
                type: 'PUT',
                url: '/docs/' + docId,
                data: data,
                error: this.errorHandler.fnMethod(this),
                success: function(data) {
                    location.hash = this.docid;
                    this.state = states.clean;
                    if (this.app.saved) {
                        this.app.saved();
                    }
                }
            });
        },

        errorHandler: function (xmlhttp, textStatus, errorThrown) {
            if (this.app.error) {
                this.app.error(textStatus);
            }
            else {
                alert(textStatus);
            }
        },

        makeDirty: function(fDirty) {
            if (fDirty == undefined) {
                fDirty = true;
            }
            // REVIEW: What if we are loading or saving? Does this
            // canel a load?
            this.state = fDirty ? states.dirty : states.clean;
        },

        // The user is about to close the page - we want to alert the
        // user if he might lose changes.
        beforeUnload: function(evt) {
            if (this.state != states.clean) {
                evt.returnValue = "You will lose your changes if you leave " +
                    "the window without saving.";
                return evt.returnValue;
            }
        },

        // Periodically poll for changes in the URL and state of user sign-in
        // Could start loading a new document
        // TODO: If the document is dirty, we don't want to overwrite it
        // without getting permission?
        poll: function () {
            if (this.lastHash != location.hash) {
                this.lastHash = location.hash;
                this.load(location.hash.substr(1));
            }
            this.checkUsername();
        },

        // See if the user sign-in state has changed by polling the cookie
        // TODO: Need to do a JSONP call to get the username if not hosting
        // on appid.pageforest.com.
        checkUsername: function () {
            var sessionkey = cookies.getCookie('sessionkey');
            var usernameLast = this.username;

            if (sessionkey !== undefined) {
                this.username = sessionkey.split('/')[1];
            }
            else {
                this.username = undefined;
            }
            if (this.app.userChanged && usernameLast != this.username) {
                this.app.userChanged(this.username || 'anonymous');
            }
        },

        // Direct the user to the Pageforest sign-in page.
        signIn: function () {
            window.open(this.wwwHost + "/sign-in/scratch/", '_blank');
        },

        // Expire the session key to remove the sign-in for the user.
        signOut: function () {
            // checkUsername will update the user state in a jiffy
            document.cookie = 'sessionkey=expired; path=/; expires=' +
                'Sat, 01 Jan 2000 00:00:00 GMT';
        }

    });

    ns.extend({
        Client: Client
    });

});
