/*
  client.js - Pageforest client api for sign in, save, load, and url
  management.

  Requires jQuery.

  TODO: This client assumes the app is hosted at appid.pageforest.com.
  It needs to be modified to support remote hosting and local filesystem
  testing.
 */

/*global jQuery $ */
namespace.lookup('com.pageforest.client').defineOnce(function (ns) {
    var cookies = namespace.lookup('org.startpad.cookies');
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');

    ns.pollInterval = 1000;

    // Error messages
    var discardMessage = "You will lose your document changes if you continue.";
    var jQueryMessage = "jQuery must be installed to use this library.";
    var signInMessage = "You must sign in to save a document.";
    var unloadMessage = "You will lose your changes if you leave " +
        "the document without saving.";
    var objectMessage = "Document data is missing.";
    var titleMessage = "Document is missing a title.";
    var blobMessage = "Document is missing a blob property.";

    // The application calls Client, and implements the following methods:
    // app.setData(jsonDocument) - Called when a new document is loaded.
    // app.getData() - Called to get the json data to be saved.
    // app.onSaveSuccess() - successfully saved.
    // app.onError(errorMessage) - Called when we get an error reading or
    //     writing a document (optional).
    // app.onUserChange(username) - Called when the user signs in or signs out
    // app.onStateChange(new, old) - Notify app about current state changes.
    function Client(app) {
        this.app = app;

        this.appHost = location.host;
        var dot = this.appHost.indexOf('.');
        this.appid = this.appHost.substr(0, dot);
        this.wwwHost = 'www' + this.appHost.substr(dot);

        this.state = 'clean';
        this.username = undefined;
        this.fLogging = false;
        // Auto save every 60 seconds
        this.saveInterval = 60;
        this.setCleanDoc(undefined, true);

        // REVIEW: When we support multiple clients per page, we can
        // combine all the poll functions into a shared one.
        setInterval(this.poll.fnMethod(this), ns.pollInterval);

        if (typeof $ != 'function' || $ != jQuery) {
            this.errorReport('jQuery_required', jQueryMessage);
            return;
        }

        // Catch window unload if the user tries to close an unsaved window
        $(window).bind('beforeunload', this.beforeUnload.fnMethod(this));
    }

    Client.methods({
        // Load a document
        load: function (docid) {
            // Your data is on notice.
            if (this.isDirty()) {
                if (!this.confirmDiscard()) {
                    return;
                }
                // Your data is dead to me.
                this.changeState('clean');
            }

            // REVIEW: What to do about race condition if already
            // loading or saving?
            this.stateSave = this.state;
            this.changeState('loading');

            this.log("loading: " + docid);
            $.ajax({
                dataType: 'json',
                url: this.getDocURL(docid),
                error: this.errorHandler.fnMethod(this),
                beforeSend: function(xhr) {
                    if (this.sessionKey) {
                        xhr.setRequestHeader("Authorization",
                                             'PFSK1 ' + this.sessionKey);
                    }
                }.fnMethod(this),
                success: function (document, textStatus, xmlhttp) {
                    this.app.setData(document);
                    this.setCleanDoc(docid);
                }.fnMethod(this)
            });
        },

        save: function (json, docid) {
            if (this.username == undefined) {
                this.errorReport('no_username', signInMessage);
                return;
            }

            if (json == undefined) {
                json = this.app.getData();
                if (typeof json != 'object') {
                    this.errorReport('missing_object', objectMessage);
                    return;
                }
                if (json.title == undefined) {
                    this.errorReport('missing_title', titleMessage);
                    return;
                }
                if (json.blob == undefined) {
                    this.errorReport('missing_blob', blobMessage);
                    return;
                }
            }

            if (docid == undefined) {
                docid = this.docid;
            }

            // First save?  Assign docid like username-slug
            // FIXME: We could over-write a previously existing document
            // with the same name.  We should do one of:
            // - Check for existence first
            // - Ask the server for a unique docid
            // - Add some randomness to the docid
            // - Use PUT if_not_exists
            if (docid == undefined) {
                docid = this.username + '-' + json.title + '-' +
                    base.randomInt(10000);
                docid = format.slugify(docid);
            }

            this.stateSave = this.state;
            this.changeState('saving');

            // Default permissions to be public readable.
            if (!json.readers) {
                json.readers = ['public'];
            }

            var data = JSON.stringify(json);
            this.log('saving: ' + this.getDocURL(docid), json);
            $.ajax({
                type: 'PUT',
                url: this.getDocURL(docid),
                data: data,
                error: this.errorHandler.fnMethod(this),
                beforeSend: function(xhr) {
                    if (this.sessionKey) {
                        xhr.setRequestHeader("Authorization",
                                             'PFSK1 ' + this.sessionKey);
                    }
                }.fnMethod(this),
                success: function(data) {
                    this.setCleanDoc(docid);
                    this.log('saved');
                    if (this.app.onSaveSuccess) {
                        this.app.onSaveSuccess();
                    }
                }.fnMethod(this)
            });
        },

        // Detach the current document from it's storage.
        detach: function() {
            this.setCleanDoc();
            this.setDirty();
        },

        // Set the document to the clean state.
        // If docid is undefined, set to the "new" document state.
        // If preserveHash, we don't modify the URL
        setCleanDoc: function(docid, preserveHash) {
            this.docid = docid;
            this.changeState('clean');
            // Remember the clean state of the document
            this.lastJSON = JSON.stringify(this.app.getData());

            // Enable polling to kick off a load().
            if (preserveHash) {
                this.lastHash = '';
                return;
            }

            if (docid == undefined) {
                docid = '';
            }

            location.hash = docid;
            this.lastHash = location.hash;
            // Chrome has a bug where the location bar is not updated unless
            // the whole thing is set.
            location.href = location.href;
        },

        getDocURL: function(docid) {
            if (docid == undefined) {
                docid = this.docid;
            }
            if (docid == undefined) {
                return undefined;
            }
            return 'http://' + this.appHost + '/docs/' + docid + '/';
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
            this.changeState(this.stateSave);
            var code = 'ajax_error/' + xmlhttp.status;
            var message = xmlhttp.statusText;
            this.log(message + ' (' + code + ')', xmlhttp);
            this.errorReport(code, message);
        },

        errorReport: function(status, message) {
            if (this.app.onError) {
                this.app.onError(status, message);
            }
            else {
                var formatted = "client error: " + message +
                    ' (' + status + ')';
                console.log(formatted);
                alert(formatted);
            }
        },

        confirmDiscard: function() {
            if (this.app.confirmDiscard) {
                return this.app.confirmDiscard();
            }
            return confirm(discardMessage);
        },

        setDirty: function(fDirty) {
            if (fDirty == undefined) {
                fDirty = true;
            }

            // Save the first dirty time
            if (!this.isDirty() && fDirty) {
                this.dirtyTime = new Date().getTime();
            }

            // REVIEW: What if we are loading or saving? Does this
            // cancel a load?
            this.changeState(fDirty ? 'dirty' : 'clean');
        },

        isDirty: function() {
            return this.state == 'dirty';
        },

        isSaved: function() {
            return this.state == 'clean' && this.docid != undefined;
        },

        changeState: function(state) {
            if (state == this.state) {
                return;
            }

            var stateOld = this.state;
            this.state = state;

            if (this.app.onStateChange) {
                this.app.onStateChange(state, stateOld);
            }
        },

        // The user is about to navigate away from the page - we want to
        // alert the user if he might lose changes.
        beforeUnload: function(evt) {
            if (this.state != 'clean') {
                evt.returnValue = unloadMessage;
                return evt.returnValue;
            }
        },

        // Periodically poll for changes in the URL and state of user sign-in
        // Could start loading a new document
        poll: function () {
            if (this.lastHash != location.hash) {
                this.lastHash = location.hash;
                this.load(location.hash.substr(1));
            }
            this.checkUsername();
            this.checkData();
        },

        // See if the user sign-in state has changed by polling the cookie
        // TODO: Need to do a JSONP call to get the username if not hosting
        // on appid.pageforest.com.
        checkUsername: function () {
            var sessionKeyExists = cookies.getCookie('sessionkey_exists');
            var usernameLast = this.username;

            if (sessionKeyExists != undefined) {
                if (!this.sessionKey) {
                    $.ajax({
                        dataType: 'text',
                        url: 'http://' + this.appHost + '/auth/get-session/',
                        error: this.errorHandler.fnMethod(this),
                        success: function (sessionKey, textStatus, xmlhttp) {
                            this.sessionKey = sessionKey;
                            this.username = sessionKey.split('|')[1];
                            this.log('signed in as ' + this.username);
                            if (this.app.onUserChange &&
                                usernameLast != this.username) {
                                this.app.onUserChange(this.username);
                            }
                        }.fnMethod(this)
                    });
                }

            }
            else {
                this.username = undefined;
                this.sessionKey = undefined;
                if (this.app.onUserChange && usernameLast != this.username) {
                    this.app.onUserChange(this.username);
                }
            }
        },

        // See if the document data has changed - assume this is not
        // expensive as we execute this every second.
        checkData: function() {
            // No auto-saving - do nothing
            if (this.saveInterval == 0) {
                return;
            }

            // See if it's time to do an auto-save
            if (this.isDirty()) {
                if (this.username == undefined) {
                    return;
                }
                var now = new Date().getTime();
                if (now - this.dirtyTime > this.saveInterval * 1000) {
                    this.save();
                }
                return;
            }

            // Don't do anything if we're saving or loading.
            if (this.state != 'clean') {
                return;
            }

            // Document looks clean - see if it's changed since we last
            // checked.
            var json = JSON.stringify(this.app.getData());
            if (json != this.lastJSON) {
                this.setDirty();
            }
        },

        // Direct the user to the Pageforest sign-in page.
        signIn: function () {
            window.open('http://' + this.wwwHost + '/sign-in/' +
                        this.appid + '/', '_blank');
        },

        // Expire the session key to remove the sign-in for the user.
        signOut: function () {
            // checkUsername will update the user state in a jiffy
            cookies.setCookie('sessionkey_exists', 'expired', -1);

            // We can't delete the Http-Only sessionkey locally -
            // use the server to do it.
            $.ajax({
                dataType: 'text',
                url: 'http://' + this.appHost + '/auth/set-session/expired/',
                error: this.errorHandler.fnMethod(this),
                success: function (sessionKey, textStatus, xmlhttp) {
                    this.log("sessionkey deleted");
                }.fnMethod(this)
            });
        }

    });

    // Exports
    ns.extend({
        Client: Client
    });

});
