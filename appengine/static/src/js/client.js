/*
  client.js - Pageforest client api for sign in, save, load, and url
  management.

  Requires jQuery.

  TODO: This client assumes the app is hosted at appid.pageforest.com.
  It needs to be modified to support remote hosting and local filesystem
  testing.
 */
namespace.lookup('com.pageforest.client').defineOnce(function (ns) {
    var cookies = namespace.lookup('org.startpad.cookies');
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');

    // TODO: Add alert if jQuery is not present.

    var pollInterval = 500;
    var discardMessage = "You will lose your document changes if you continue.";

    // The application calls Client, and implements the following methods:
    // app.loaded(jsonDocument) - Called when a new document is loaded
    // app.saved() - successfully saved
    // app.error(errorMessage) - Called when we get an error reading or
    //     writing a document (optional).
    // app.userChanged(username) - Called when the user signs in or signs out
    //     ('anonymous').
    function Client(app) {
        this.app = app;

        // TODO: Support remote and local filesytem hosting.
        this.appHost = location.host;
        var dot = this.appHost.indexOf('.');
        this.appid = this.appHost.substr(0, dot);
        this.wwwHost = 'www' + this.appHost.substr(dot);

        this.lastHash = '';
        this.state = Client.states.clean;
        this.username = undefined;
        this.fLogging = false;

        // REVIEW: When we support multiple clients per page, we can
        // combine all the poll functions into a shared one.
        setInterval(this.poll.fnMethod(this), pollInterval);

        // Catch window unload if the user tries to close an unsaved window
        $(window).bind('beforeunload', this.beforeUnload.fnMethod(this));
    }

    Client.states = new base.Enum('clean', 'dirty', 'loading', 'saving');

    Client.methods({
        // Load a document
        load: function (docid) {
            // Your data is on notice.
            if (this.state == Client.states.dirty) {
                if (!this.confirmDiscard()) {
                    return;
                }
                // Your data is dead to me.
                this.state = Client.states.clean;
            }

            // REVIEW: What to do about race condition if already
            // loading or saving?
            this.stateSave = this.state;
            this.state = Client.states.loading;

            this.log("loading: " + docid);
            $.ajax({
                dataType: 'json',
                url: 'http://' + this.appHost + '/docs/' + docid,
                error: this.errorHandler.fnMethod(this),
                success: function (document, textStatus, xmlhttp) {
                    this.setCleanDoc(docid);
                    // Required
                    this.app.loaded(document);
                }.fnMethod(this)
            });
        },

        save: function (json, docid) {
            if (this.username == undefined) {
                this.errorReport('no_username', "You must sign in to save.");
            }

            if (json == undefined) {
                json = this.app.getData();
            }

            if (docid == undefined) {
                docid = this.docid;
            }

            // First save?  Assign docid like username-slug
            if (docid == undefined) {
                docid = this.username + '-' + json.title;
                docid = format.slugify(docid);
            }

            this.stateSave = this.state;
            this.state = Client.states.saving;

            // Default permissions to be public readable.
            if (!json.readers) {
                json.readers = ['public'];
            }

            var data = JSON.stringify(json);
            this.log('saving: ' + docid, json);
            $.ajax({
                type: 'PUT',
                url: '/docs/' + docid,
                data: data,
                error: this.errorHandler.fnMethod(this),
                success: function(data) {
                    this.setCleanDoc(docid);
                    this.log('saved');
                    if (this.app.saved) {
                        this.app.saved();
                    }
                }.fnMethod(this)
            });
        },

        setCleanDoc: function(docid) {
            this.docid = docid;
            this.state = Client.states.clean;
            location.hash = this.docid;
            // Don't trigger a load after we just saved.
            this.lastHash = location.hash;
        },

        setLogging: function(f) {
            f = (f == undefined) ? true : f;
            this.fLogging = f;
        },

        log: function(message, obj) {
            if (this.fLogging) {
                // BUG: console.log.apply(undefined, arguments) work in Chrome!
                if (obj != undefined) {
                    console.log(message, obj);
                }
                else {
                    console.log(message);
                }
            }
        },

        errorHandler: function (xmlhttp, textStatus, errorThrown) {
            this.state = this.stateSave;
            var code = 'ajax_error/' + xmlhttp.status;
            var message = xmlhttp.statusText;
            this.log(message + ' (' + code + ')', xmlhttp);
            this.errorReport(code, message);
        },

        errorReport: function(status, message) {
            if (this.app.error) {
                this.app.error(status, message);
            }
            else {
                alert(status + ': ' + message);
            }
        },

        confirmDiscard: function() {
            if (this.app.confirmDiscard) {
                return this.app.confirmDiscard();
            }
            return confirm(discardMessage);
        },

        makeDirty: function(fDirty) {
            if (fDirty == undefined) {
                fDirty = true;
            }
            // REVIEW: What if we are loading or saving? Does this
            // canel a load?
            this.state = fDirty ? Client.states.dirty : Client.states.clean;
        },

        // The user is about to navigate away from the page - we want to
        // alert the user if he might lose changes.
        beforeUnload: function(evt) {
            if (this.state != Client.states.clean) {
                evt.returnValue = "You will lose your changes if you leave " +
                    "the document without saving.";
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
                this.log('found user: ' + this.username);
                this.app.userChanged(this.username || 'anonymous');
            }
        },

        // Direct the user to the Pageforest sign-in page.
        signIn: function () {
            window.open('http://' + this.wwwHost + "/sign-in/" +
                        this.appid + "/", '_blank');
        },

        // Expire the session key to remove the sign-in for the user.
        signOut: function () {
            // checkUsername will update the user state in a jiffy
            document.cookie = 'sessionkey=expired; path=/; expires=' +
                'Sat, 01 Jan 2000 00:00:00 GMT';
        }

    });

    // Exports
    ns.extend({
        Client: Client
    });

});
