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
    var dom = namespace.lookup('org.startpad.dom');
    var dialog = namespace.lookup('org.startpad.dialog');
    var vector = namespace.lookup('org.startpad.vector');

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
    var docUnsavedMessage = "Document must be saved before " +
        "children can be saved.";
    var docidMessage = "Document name is missing.";

    var docProps = ['title', 'tags',
                    'owner', 'readers', 'writers',
                    'created', 'modified'];

    // The application calls Client, and implements the following methods:
    // app.setDoc(jsonDocument) - Called when a new document is loaded.
    // app.getDoc() - Called to get the json data to be saved.
    // app.onSaveSuccess(status) - successfully saved.
    // app.onError(status, errorMessage) - Called when we get an error
    //     reading or writing a document (optional).
    // app.onUserChange(username) - Called when the user signs in or signs out
    // app.onStateChange(new, old) - Notify app about current state changes.
    function Client(app) {
        this.app = app;

        this.meta = {};
        this.metaDoc = {};
        this.metaDialog = {};

        if (typeof $ != 'function' || $ != jQuery) {
            this.onError('jQuery_required', jQueryMessage);
            return;
        }

        this.appHost = window.location.host;
        var dot = this.appHost.indexOf('.');
        this.appid = this.appHost.substr(0, dot);
        this.wwwHost = 'www' + this.appHost.substr(dot);

        this.state = 'init';
        this.username = undefined;
        this.fLogging = true;
        this.fFirstPoll = true;

        // Auto save every 60 seconds
        this.saveInterval = 60;

        // Map deprecated function names.
        var deprecated = {
            "getData": "getDoc",
            "setData": "setDoc"
        };
        for (var oldName in deprecated) {
            if (deprecated.hasOwnProperty(oldName)) {
                var newName = deprecated[oldName];
                if (app[oldName] && !app[newName]) {
                    this.log("deprecated function " + oldName +
                             " should be renamed to " + newName,
                             {'level': 'warn'});
                    app[newName] = app[oldName];
                }
            }
        }

        // REVIEW: When we support multiple clients per page, we can
        // combine all the poll functions into a shared one.
        // Note that we cannot kick off a poll() until this constructor
        // returns as the app's callbacks likely depend on completing their
        // initialization.
        setInterval(this.poll.fnMethod(this), ns.pollInterval);

        // Catch window unload if the user tries to close an unsaved window
        $(window).unload(this.beforeUnload.fnMethod(this));
    }

    Client.methods({
        /* These methods are related to document state management. The
           application has a "current document" state (clean, dirty,
           loading, or saving).

           load - load a document as the current document.
           save - save the current document.
           detach - disassociate the current document from a saved docid.
           setCleanDoc - mark the document as 'clean' and update the
               browser address.
           checkDoc - polls to see if a document has changed.
           addAppBar - add a standards user interface element
           */

        // Load a document as the default document for this running application.
        load: function (docid) {
            if (this.app.setDoc == undefined) {
                return;
            }

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
                success: function (doc, textStatus, xmlhttp) {
                    this.setDoc(doc);
                    this.setCleanDoc(docid);
                }.fnMethod(this)
            });
        },

        save: function (json, docid) {
            if (this.isSaved()) {
                return;
            }

            // TODO: Call this.putDoc - and then handle the document
            // state in the callback function.
            if (this.username == undefined) {
                this.onError('no_username', signInMessage);
                return;
            }

            if (json == undefined) {
                json = this.getDoc();
                if (json.blob == undefined) {
                    this.onError('missing_blob', blobMessage);
                    return;
                }
            }

            docid = docid || this.docid;

            // First save?  Assign docid like username-slug
            // FIXME: We could over-write a previously existing document
            // with the same name.  We should do one of:
            // - Check for existence first
            // - Ask the server for a unique docid
            // - Add some randomness to the docid
            // - Use PUT if_not_exists
            if (docid == undefined) {
                docid = this.username + '-' + base.randomInt(10000);
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
                success: function(result, textStatus, xmlhttp) {
                    // TODO: The server can return the docid for cases where
                    // the server assigns the id instead of the client.
                    result.docid = docid;
                    // If we had no owner before - set it to document's
                    // creator (the current user).
                    result.owner = json.owner || this.username;
                    this.onSaveSuccess(result);
                }.fnMethod(this)
            });
        },

        onSaveSuccess: function(result) {
            base.extendIfChanged(this.meta, this.metaDoc,
                                 base.project(result, ['modified', 'owner']));
            this.setCleanDoc(result.docid);

            this.setAppPanelValues(this.meta);

            this.log('saved');
            if (this.app.onSaveSuccess) {
                this.app.onSaveSuccess(result);
            }
        },

        // Detach the current document from it's storage.
        detach: function() {
            this.meta.owner = this.metaDoc.owner = undefined;
            this.meta.modified = this.metaDoc.modified = undefined;
            this.setCleanDoc();
            this.setDirty();
            this.setAppPanelValues(this.meta);
        },

        // Get document properties from client and merge with last
        // saved meta properties.
        getDoc: function() {
            var doc = this.app.getDoc();
            if (typeof doc != 'object') {
                doc = {};
            }
            base.extendIfMissing(doc, {'title': document.title});

            // Synchronize any changes made in the dialog or
            // the document.
            var fDoc = base.extendIfChanged(this.meta, this.metaDoc,
                                            base.project(doc, docProps));
            base.extendIfChanged(this.meta, this.metaDialog,
                                 this.getAppPanelValues());
            base.extendObject(doc, this.meta);

            // Update the dialog if the changes come from the document.
            if (fDoc) {
                this.setAppPanelValues(this.meta);
            }

            return doc;
        },

        // Set document - retaining meta properties for later use.
        setDoc: function(doc) {
            this.meta = base.project(doc, docProps);
            this.setAppPanelValues(this.meta);
            this.app.setDoc(doc);
        },

        // Set the document to the clean state.
        // If docid is undefined, set to the "new" document state.
        // If preserveHash, we don't modify the URL
        setCleanDoc: function(docid, preserveHash) {
            this.docid = docid;
            this.changeState('clean');
            // Remember the clean state of the document
            this.lastJSON = JSON.stringify(this.getDoc());

            // Enable polling to kick off a load().
            if (preserveHash) {
                this.lastHash = '';
                return;
            }

            if (docid == undefined) {
                docid = '';
            }

            window.location.hash = docid;
            this.lastHash = window.location.hash;
            // Chrome has a bug where the location bar is not updated unless
            // the whole thing is set.
            window.location.href = window.location.href;
        },

        // See if the document data has changed - assume this is not
        // expensive as we execute this on a timer.
        checkDoc: function() {
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
                    // Don't try again for another saveInterval in case
                    // the save fails.
                    this.dirtyTime = now;
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
            // TODO: Don't get the document if the app has it's own
            // isDirty function.
            var json = JSON.stringify(this.getDoc());
            if (json != this.lastJSON) {
                this.setDirty();
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

        canSave: function() {
            return this.username != undefined &&
                (this.docid == undefined ||
                 (this.username == this.meta.owner ||
                  base.valueInArray(this.username, this.meta.writers)));
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

            if (this.appBar) {
                // Only disable the save button if the doc is already saved
                // by the current user.
                if (this.isSaved() && this.canSave()) {
                    $('#pfSave').addClass('disabled');
                }
                else {
                    $('#pfSave').removeClass('disabled');
                }
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

        /* Low-level storage primitives for saving and loading documents
           and blobs.

           TODO: Move putDoc, getDoc, putBlob, and setBlob into another
           module, com.pageforest.storage, and refactor client.
           */

        // Save a document - does not have to be the "main" document
        // that the user is currently viewing.
        putDoc: function (docid, json, fn) {
            if (!fn) {
                fn = function () {};
            }

            var validations = {
                'no_username': [this.username, signInMessage],
                'missing_document_name': [docid, docidMessage],
                'missing_object': [json, objectMessage],
                'missing_title': [json && json.title, titleMessage],
                'missing_blob': [json && json.blob, blobMessage]
            };

            for (var code in validations) {
                if (validations.hasOwnProperty(code)) {
                    var validation = validations[code];
                    if (!validation[0]) {
                        this.onError(code, validation[1]);
                        fn(false);
                        return;
                    }
                }
            }

            // Default permissions to be public readable.
            if (!json.readers) {
                json.readers = ['public'];
            }

            var data = JSON.stringify(json);
            this.log('saving document: ' + this.getDocURL(docid), json);
            $.ajax({
                type: 'PUT',
                url: this.getDocURL(docid),
                data: data,
                error: function (xmlhttp, textStatus, errorThrown) {
                    this.errorHandler(xmlhttp, textStatus, errorThrown);
                    fn(false);
                },
                success: function () {
                    fn(true);
                }
            });
        },

        // Save a child blob in the namespace of a document
        putBlob: function(docid, blobid, data, options, fn) {
            fn = fn || function () {};
            options = options || {};

            if (docid == undefined) {
                this.onError('unsaved_document', docUnsavedMessage);
                fn(false);
                return;
            }

            var url = this.getDocURL(docid) + blobid;
            var query_string = [];
            if (options.encoding) {
                query_string.push('transfer-encoding=' + options.encoding);
            }
            if (options.tags) {
                query_string.push('tags=' + options.tags.join(','));
            }
            query_string = query_string.join('&');
            if (query_string) {
                url += '?' + query_string;
            }

            if (typeof data != "string") {
                data = JSON.stringify(data);
            }
            this.log('saving blob: ' + url + ' (' + data.length + ')');
            $.ajax({
                type: 'PUT',
                url: url,
                data: data,
                dataType: 'json',
                processData: false,
                error: function (xmlhttp, textStatus, errorThrown) {
                    var code = 'ajax_error/' + xmlhttp.status;
                    var message = xmlhttp.statusText;
                    this.log(message + ' (' + code + ') ' + url,
                             {'obj': xmlhttp});
                    this.onError(code, message);
                    fn(false);
                }.fnMethod(this),
                success: function() {
                    this.log('saved blob: ' + url);
                    fn(true);
                }.fnMethod(this)
            });
        },

        // Read a child blob in the namespace of a document
        // TODO: refactor to share code with putBlob
        getBlob: function(docid, blobid, options, fn) {
            fn = fn || function () {};
            options = options || {};
            var type = 'GET';

            if (docid == undefined) {
                this.onError('unsaved_document', docUnsavedMessage);
                fn(false);
                return;
            }

            var url = this.getDocURL(docid) + blobid;
            if (options.encoding || options.tags) {
                url += '?';
            }
            if (options.encoding) {
                url += 'transfer-encoding=' + options.encoding;
            }
            if (options.tags) {
                var encodedTags = base.map(options.tags, encodeURIComponent);
                url += 'tags=' + encodedTags.join(',');
            }
            if (options.headOnly) {
                type = 'HEAD';
            }
            this.log('reading blob: ' + docid + '/' + blobid);
            $.ajax({
                'type': type,
                'url': url,
                // REVIEW: Is this the right default - note that 200 return
                // codes can return error because the data is NOT json!
                'dataType': options.dataType || 'json',
                'error': function (xmlhttp, textStatus, errorThrown) {
                    var code = 'ajax_error/' + xmlhttp.status;
                    var message = xmlhttp.statusText;
                    this.log(message + ' (' + code + ')', {'obj': xmlhttp});
                    this.onError(code, message);
                    fn(false);
                }.fnMethod(this),
                'success': function(data) {
                    this.log('read blob: ' + url);
                    fn(true, data);
                }.fnMethod(this)
            });
        },


        // Return the URL for a document or blob.
        getDocURL: function(docid, blobid) {
            if (docid == undefined) {
                docid = this.docid;
            }
            if (docid == undefined) {
                return undefined;
            }
            if (blobid == undefined) {
                blobid = '';
            }
            return 'http://' + this.appHost + '/docs/' + docid + '/' + blobid;
        },

        setLogging: function(f) {
            f = (f == undefined) ? true : f;
            this.fLogging = f;
        },

        log: function(message, options) {
            if (!this.fLogging) {
                return;
            }
            if (options == undefined) {
                options = {};
            }
            if (!options.hasOwnProperty('level')) {
                options.level = 'log';
            }
            if (options.hasOwnProperty('obj')) {
                console[options.level](message, options.obj);
            } else {
                console[options.level](message);
            }
        },

        errorHandler: function (xmlhttp, textStatus, errorThrown) {
            this.changeState(this.stateSave);
            var code = 'ajax_error/' + xmlhttp.status;
            var message = xmlhttp.statusText;
            if (message.toLowerCase() == "forbidden") {
                message = "You don't have permission to save to this " +
                    "document.  You may want to make a copy, instead.";
            }
            this.log(message + ' (' + code + ')', {'obj': xmlhttp});
            this.onError(code, message);
        },

        onError: function(status, message) {
            var formatted = "client error: " + message +
                ' (' + status + ')';
            this.log(formatted);

            this.showError(message);

            if (this.app.onError) {
                this.app.onError(status, message);
            }
        },

        // Periodically poll for changes in the URL and state of user sign-in
        // Could start loading a new document
        poll: function () {
            // Callbacks to app are deferred until poll is called.
            if (this.state == 'init') {
                if (this.getDoc) {
                    this.setCleanDoc(undefined, true);
                }
            }

            if (this.lastHash != window.location.hash) {
                this.lastHash = window.location.hash;
                this.load(window.location.hash.substr(1));
            }
            this.checkUsername();
            this.checkDoc();
            this.fFirstPoll = false;
        },

        // See if the user sign-in state has changed by polling the cookie
        // TODO: Need to do a JSONP call to get the username if not hosting
        // on appid.pageforest.com.
        checkUsername: function () {
            var sessionUser = cookies.getCookie('sessionuser');
            var usernameLast = this.username;

            if (sessionUser != undefined) {
                if (sessionUser != this.username) {
                    this.username = sessionUser;
                    this.log('signed in as ' + this.username);
                    this.onUserChange(this.username);
                }
            } else {
                if (this.username || this.fFirstPoll) {
                    this.username = undefined;
                    this.onUserChange(this.username);
                }
            }
        },

        onUserChange: function(username) {
            if (this.app.onUserChange) {
                this.app.onUserChange(username);
            }
            if (this.appBar) {
                var isSignedIn = username != undefined;
                if (isSignedIn) {
                    $('#pfWelcome').show();
                    $('#pfUsername')
                        .text(isSignedIn ? username : 'anonymous')
                        .show();
                } else {
                    $('#pfWelcome').hide();
                    $('#pfUsername').hide();
                }
                $('#pfSignIn').text(isSignedIn ? 'Sign Out' : 'Sign In');
            }
        },

        // Add a standard user interface to the web page.
        addAppBar: function() {
            var htmlAppBar =
                '<div id="pfAppBarBox">' +
                '<div class="pfLeft"></div>' +
                '<div class="pfCenter">' +
                '<span id="pfWelcome">Welcome,</span>' +
                '<span class="pfLink" id="pfUsername"></span>' +
                '<span class="pfLink" id="pfSignIn">Sign In</span>' +
                '<span class="pfLink" id="pfSave">Save</span>' +
                '<div class="expander collapsed" id="pfMore"></div>' +
                '<div id="pfLogo"></div>' +
                '</div>' +
                '<div class="pfRight"></div>' +
                '</div>';

            this.appBar = document.getElementById('pfAppBar');
            if (!this.appBar) {
                document.body.style.marginTop = "39px";
                this.appBar = document.createElement('div');
                this.appBar.setAttribute('id', 'pfAppBar');
                this.appBar.style.position = 'absolute';
                this.appBar.style.top = '0';
                this.appBar.style.left = '0';
                document.body.appendChild(this.appBar);
            }

            this.appBar.innerHTML = htmlAppBar;
            // For use in closures, below.
            var self = this;

            $('#pfSignIn').click(function () {
                self.signInOut();
            });

            function onSaveClose() {
                self.save();
                self.toggleAppPanel(false);
            }

            function onSave() {
                // If this is a first-save, pop open the dialog
                // so the user can set the doc title, etc.
                if (self.docid == undefined) {
                    self.toggleAppPanel(true);
                    return;
                }
                onSaveClose();
            }

            function onCopy() {
                self.detach();
                self.toggleAppPanel();
            }

            $('#pfSave').click(onSave);

            self.appPanel = document.createElement('div');
            self.appPanel.setAttribute('id', 'pfAppPanel');
            self.appDialog = new dialog.Dialog({
                fields: [
                    {name: 'message', type: 'message'},
                    {name: 'title', required: true},
                    {name: 'tags'},
                    {name: 'publicReader', label: "Public", type: 'checkbox'},
                    {name: 'owner', type: 'value'},
                    {name: 'writers', label: "Co-authors"},
                    {name: 'modified', label: "Last Saved", type: 'value'},
                    {name: 'save', label: "Save Now", type: 'button',
                     onClick: onSaveClose},
                    {name: 'copy', label: "Make a Copy", type: 'button',
                     onClick: onCopy}
                ]
            });
            document.body.appendChild(self.appPanel);
            $(self.appPanel).html(self.appDialog.html());

            // TODO: Make this available to apps not using the appPanel?
            self.errorPanel = document.createElement('div');
            self.errorPanel.setAttribute('id', 'pfErrorPanel');
            self.errorDialog = new dialog.Dialog({
                fields: [
                    {name: 'error', type: 'message'}
                ]
            });
            document.body.appendChild(self.errorPanel);
            $(self.errorPanel).html(self.errorDialog.html());

            $('#pfMore').click(function() {
                if (self.toggleAppPanel()) {
                    self.setAppPanelValues(self.meta);
                }
            });

            $('#pfUsername').click(function() {
                window.open('http://' + self.wwwHost + '/docs/');
            });

            $('#pfLogo').click(function() {
                window.open('http://' + self.wwwHost);
            });

            $(window).resize(function() {
                self.positionAppPanel();
            });
        },

        toggleAppPanel: function(fOpen) {
            if (fOpen != undefined &&
                fOpen == $(this.appPanel).is(':visible')) {
                return;
            }
            var self = this;

            $('#pfMore').toggleClass("expanded collapsed");
            if ($(this.appPanel).is(':visible')) {
                this.positionAppPanel('hide');
                return false;
            } else {
                this.positionAppPanel('show', function() {
                    self.appDialog.setFocus();
                });
                return true;
            }
        },

        positionAppPanel: function(animation, fnCallback) {
            if (animation == undefined && !$(this.appPanel).is(':visible')) {
                return;
            }
            var rcAppBox = dom.getRect($('#pfAppBarBox')[0]);
            dom.slide(this.appPanel, vector.lr(rcAppBox), animation,
                      fnCallback);
        },

        showError: function(message) {
            var rcAppBox = dom.getRect($('#pfAppBarBox')[0]);

            if (this.errorPanel == undefined) {
                return;
            }
            if (message == undefined) {
                dom.slide(this.errorPanel, vector.lr(rcAppBox), 'hide');
                return;
            }

            this.errorDialog.setValues({'error': message});
            dom.slide(this.errorPanel, vector.lr(rcAppBox), 'show');

            var self = this;
            function retract() {
                self.showError();
            }
            setTimeout(retract, 3000);
        },

        setAppPanelValues: function(doc) {
            if (this.appPanel == undefined) {
                return;
            }
            var values = {};
            // Turn the last-save date to a string.
            values.title = doc.title;
            values.owner = doc.owner;
            values.modified = format.shortDate(
                format.decodeClass(doc.modified));
            values.tags = format.wordList(doc.tags);
            values.writers = format.wordList(doc.writers);
            values.publicReader = base.valueInArray('public',
                                                    doc.readers);
            if (this.docid == undefined) {
                this.appDialog.enableField('message', true);
                values.message = "Before saving, you can choose a new " +
                    "title for your document.";
            } else {
                this.appDialog.enableField('message', false);
            }
            this.appDialog.setValues(values);
            this.appDialog.enableField('copy', this.docid != undefined);
        },

        getAppPanelValues: function() {
            if (this.appPanel == undefined ||
                !$(this.appPanel).is(':visible')) {
                return {};
            }

            var values = {};
            var dlg = this.appDialog.getValues();

            values.title = dlg.title;
            values.owner = dlg.owner;
            values.tags = format.arrayFromWordList(dlg.tags);
            values.writers = format.arrayFromWordList(dlg.writers);
            values.readers = dlg.publicReader ? ['public'] : [];

            return values;
        },

        // Sign in (or out) depending on current user state.
        signInOut: function() {
            var isSignedIn = this.username != undefined;
            if (isSignedIn) {
                this.signOut();
            }
            else {
                this.signIn();
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
            cookies.setCookie('sessionuser', 'expired', -1);
            cookies.setCookie('sessionkey', 'expired', -1);

            // Some browsers don't allow writing to HttpOnly cookies -
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
