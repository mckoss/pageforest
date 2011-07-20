/*
  client.js - Pageforest client api for sign in, save, load, and url
  management.
 */

/*global jQuery $ */
namespace.lookup('com.pageforest.client').define(function (exports) {
    var require = namespace.lookup;
    var util = namespace.util;
    var storage = require('com.pageforest.storage');
    var cookies = require('org.startpad.cookies');
    var base = require('org.startpad.base');
    var format = require('org.startpad.format');
    var dom = require('org.startpad.dom');
    var dialog = require('org.startpad.dialog');
    var vector = require('org.startpad.vector');
    var random = require('org.startpad.random');

    // Exports
    exports.extend({
        VERSION: "0.7.0",
        Client: Client
    });


    // Error messages
    var discardMessage = "You will lose your document changes if you continue.";
    var jQueryMessage = "jQuery must be installed to use this library.";
    var unloadMessage = "You will lose your changes if you leave " +
        "the document without saving.";
    var noSetDocMessage = "This app does not have a setDoc method " +
        "and so cannot be loaded.";
    var noGetDocMessage = "This app does not have a getDoc method " +
        "and so cannot be saved.";
    var noAppMessage = "Warning: no app object provided - " +
        "only direct storage api's can be used.";
    var autoLoadError = "Not autoloading: ";

    var docProps = ['title', 'docid', 'tags',
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
    // app.onInfo(code, message) - Informational messages about the client
    //     status.
    // app.getDocid() - Override to change behavior of getting document id from url.
    // app.setDocid() - "
    function Client(app, options) {
        if (typeof jQuery != 'function') {
            this.onError('jQuery_required', jQueryMessage);
            return;
        }

        // Make a dummy app if none given - but warn the developer.
        if (app == undefined) {
            this.log(noAppMessage, {level: 'warn'});
            app = {};
        }

        this.app = app;
        this.errorHandler = this.errorHandler.fnMethod(this);
        this.poll = this.poll.fnMethod(this);
        this.storage = new storage.Storage(this);

        var defaultOptions = {
            oneDocPerUser: false,
            fLogging: true,
            saveInterval: 60,
            autoLoad: false,
            pollInterval: 1000
        };
        util.extendObject(this, defaultOptions, options);

        this.meta = {};
        this.metaDoc = {};
        this.metaDialog = {};

        this.appHost = window.location.host;
        var dot = this.appHost.indexOf('.');
        this.appid = this.appHost.substr(0, dot);
        this.wwwHost = 'www' + this.appHost.substr(dot);

        this.state = 'init';
        this.username = undefined;
        this.logged = {};
        this.lastDocid = undefined;
        this.fFirstPoll = true;
        this.uid = random.randomString(20);

        // Auto save every 60 seconds

        if (typeof app.getDoc == 'function') {
            this.emptyDoc = app.getDoc();
        }

        // Note that we cannot kick off a poll() until this constructor
        // returns as the app's callbacks likely depend on completing their
        // initialization.
        setInterval(this.poll, this.pollInterval);
        setTimeout(this.poll, 0);

        // Note that jquery.unload happens too late?
        window.onbeforeunload = this.beforeUnload.fnMethod(this);
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

        getDocURL: function(blobid) {
            if (this.docid == undefined) {
                return undefined;
            }
            return this.storage.getDocURL(this.docid, blobid);
        },

        // Load a document as the default document for this running application.
        load: function (docid) {
            if (this.app.setDoc == undefined) {
                this.log(noSetDocMessage, {level: 'warn', once: true});
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
            this.docid = docid;
            this.changeState('loading');

            var self = this;
            this.storage.getDoc(docid, undefined, function (doc) {
                // If we're actually loading a blob - there is no docid returned.
                if (doc.doc_id == undefined) {
                    doc.doc_id = docid;
                }
                self.setDoc(doc);
            });
        },

        save: function (json, docid) {
            // BUG: If called by client to force a save - then this
            // is a no-op - but the doc might be dirty - esp if
            // we are not autosaving and polling for dirty state!
            if (!json && this.isSaved()) {
                return;
            }

            if (json == undefined) {
                json = this.getDoc();
            }

            docid = this.ensureDocid(docid || this.docid || json.docid);

            this.stateSave = this.state;
            this.changeState('saving');

            var self = this;
            this.storage.putDoc(docid, json, undefined, function(result) {
                self.onSaveSuccess(result);
            });
        },

        ensureDocid: function(docid) {
            if (docid) {
                return docid;
            }
            return format.slugify([this.username, base.randomInt(10000)].join(' '));
        },

        onSaveSuccess: function(result) {
            base.extendIfChanged(this.meta, this.metaDoc,
                                 base.project(result,
                                              ['modified', 'owner', 'sha1']));

            // If the docid is not in the result - just use the original docid.
            // REVIEW: get rid of this.docid and use this.meta.docid always?
            this.setCleanDoc(result.docid || this.docid || this.meta.docid);

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
        },

        // Get document properties from client and merge with last
        // saved meta properties.
        getDoc: function() {
            var doc = typeof this.app.getDoc == 'function' && this.app.getDoc();
            if (typeof doc != 'object') {
                this.log(noGetDocMessage, {level: 'warn', once: true});
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

            return doc;
        },

        // Set document - retaining meta properties for later use.
        setDoc: function(doc) {
            this.meta = base.project(doc, docProps);
            this.app.setDoc(doc);
            this.setCleanDoc(doc.doc_id);
        },

        // Callback function for auto-load subscribtion
        // TODO: Compare Sha1 hashes - not modified date to ignore a notify
        onAutoLoad: function (message) {
            if (!this.autoLoad || this.state != 'clean' ||
                message.key != this.docid.toLowerCase() + '/' ||
                message.data.modified.isoformat == this.meta.modified.isoformat) {
                this.log(autoLoadError + message.key);
                return;
            }
            this.load(this.docid);
        },

        // Set the document to the clean state.
        // If docid is undefined, set to the "new" document state.
        // If preserveHash, we don't modify the URL
        setCleanDoc: function(docid, preserveDocid) {
            this.docid = this.meta.docid = docid;
            this.changeState('clean');

            // Remember the clean state of the document
            this.lastJSON = storage.jsonToString(this.getDoc());

            // Subscribe to document changes if we're an auto-load document
            if (this.autoLoad && this.docid != undefined) {
                if (!this.storage.hasSubscription(this.docid)) {
                    this.storage.subscribe(this.docid, undefined,
                                           {exclusive: true},
                                           this.onAutoLoad.fnMethod(this));
                }
            }

            // Update App Panel if it's open
            this.setAppPanelValues(this.meta);

            // Enable polling to kick off a load().
            if (preserveDocid) {
                this.lastDocid = undefined;
                return;
            }

            this.setDocid(docid);
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
            var json = storage.jsonToString(this.getDoc());
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
                  base.indexOf(this.username, this.meta.writers)) != -1);
        },

        changeState: function(state) {
            if (state == this.state) {
                return;
            }

            var stateOld = this.state;
            this.state = state;

            this.log("state:" + stateOld + ' -> ' + state);

            if (this.app.onStateChange) {
                this.app.onStateChange(state, stateOld);
            }

            if (this.appBar) {
                // Only disable the save button if the doc is already saved
                // by the current user.
                if (this.isSaved() && this.canSave()) {
                    jQuery('#pfSave').addClass('disabled');
                }
                else {
                    jQuery('#pfSave').removeClass('disabled');
                }
            }
        },

        // The user is about to navigate away from the page - we want to
        // alert the user if he might lose changes.
        beforeUnload: function(evt) {
            evt = evt || window.event;
            if (this.state != 'clean') {
                evt.returnValue = unloadMessage;
                return unloadMessage;
            }
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
            if (options.once) {
                if (this.logged[message]) {
                    return;
                }
                this.logged[message] = true;
            }

            if (options.hasOwnProperty('obj')) {
                console[options.level](message, options.obj);
            } else {
                console[options.level](message);
            }
        },

        errorHandler: function (xmlhttp, textStatus, errorThrown) {
            var message;
            var skipError = false;

            if (this.state == 'loading'  && this.emptyDoc) {
                this.app.setDoc(this.emptyDoc);
                skipError = this.oneDocPerUser;
            }
            if (this.stateSave) {
                this.changeState(this.stateSave);
                this.stateSave = undefined;
            }
            if (skipError) {
                return;
            }
            var code = 'ajax_error/' + xmlhttp.status;
            message = xmlhttp.responseText;
            try {
                var json = JSON.parse(message);
                if (json.statusText) {
                    message = json.statusText;
                }
            } catch (e) {
                if (message.length > 100) {
                    message = xmlhttp.statusText;
                }
            }

            this.onError(code, message);
        },

        onError: function(status, message) {
            this.log(message + ' (' + status + ')');
            if (this.app.onError) {
                if (this.app.onError(status, message)) {
                    return;
                }
            }
            this.showError(message);
        },

        onInfo: function(code, message) {
            this.log(message + ' (' + code + ')');
            if (this.app.onInfo) {
                this.app.onInfo(code, message);
            }
        },

        // This function called to get the current document id - when it
        // changes, a load() will be automatically started.  Should return
        // undefined if no current document is set.
        // The default behavior is to read the #hash from the URL.
        getDocid: function () {
            var hash;
            if (this.oneDocPerUser) {
                return this.username;
            }

            if (this.app.getDocid) {
                return this.app.getDocid();
            }

            hash = window.location.hash.substr(1);
            return hash == '' ? undefined : hash;
        },

        // The app can provide a setDocid function, if it want's to
        // display (or store) the current docid.  The default implementation
        // writes in the the URL #hash.
        setDocid: function (docid) {
            this.lastDocid = docid;

            if (this.oneDocPerUser) {
                return;
            }

            if (this.app.setDocid) {
                return this.app.setDocid(docid);
            }

            window.location.hash = docid == undefined ? '' : docid;
        },

        // Periodically poll for changes in the URL and state of user sign-in
        // Could start loading a new document
        poll: function () {
            var docid;

            // Callbacks to app are deferred until poll is called.
            if (this.state == 'init') {
                if (this.getDoc) {
                    this.setCleanDoc(undefined, true);
                }
            }

            if (this.isAppPanelOpen()) {
                return;
            }

            // Check for change in docid to trigger a load.
            docid = this.getDocid();
            if (this.lastDocid != docid) {
                this.lastDocid = docid;
                this.load(docid);
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

            // User is signed in
            if (sessionUser != undefined) {
                if (sessionUser != this.username) {
                    this.username = sessionUser;
                    this.onUserChange(this.username);
                }
                return;
            }

            // User is signed out
            if (this.username || this.fFirstPoll) {
                this.username = undefined;
                this.onUserChange(this.username);
            }
        },

        onUserChange: function() {
            this.log("user: " + this.username);
            this.updateAppBar();
            if (this.app.onUserChange) {
                this.app.onUserChange(this.username);
            }
        },

        updateAppBar: function () {
            if (this.appBar) {
                var isSignedIn = this.username != undefined;
                if (isSignedIn) {
                    jQuery('#pfWelcome').show();
                    jQuery('#pfUsername')
                        .text(isSignedIn ? this.username : 'anonymous')
                        .show();
                } else {
                    jQuery('#pfWelcome').hide();
                    jQuery('#pfUsername').hide();
                }
                jQuery('#pfSignIn').text(isSignedIn ? 'Sign Out' : 'Sign In');
            }
        },

        // Add a standard user interface to the web page.
        addAppBar: function() {
            var htmlAppBar =
                '<div id="pfAppBarBox">' +
                '<div class="pfLeft"></div>' +
                '<div class="pfCenter">' +
                '{welcome}' +
                '<span class="pfLink" id="pfUsername"></span>' +
                '<span class="pfLink" id="pfSignIn">Sign In</span>' +
                '<span class="pfLink" id="pfSave">Save</span>' +
                '<div class="expander collapsed" id="pfMore"></div>' +
                '{logo}' +
                '</div>' +
                '<div class="pfRight"></div>' +
                '</div>';

            var objFill;
            if (screen.width >= 640) {
                objFill = {
                    welcome: '<span id="pfWelcome">Welcome,</span>',
                    logo: '<div id="pfLogo"></div>'
                };
            } else {
                objFill = {
                    welcome: '',
                    logo: ''
                };
            }
            htmlAppBar = format.replaceKeys(htmlAppBar, objFill);

            this.appBar = document.getElementById('pfAppBar');
            if (!this.appBar) {
                document.body.style.marginTop = "39px";
                document.body.style.position = "relative";
                this.appBar = document.createElement('div');
                this.appBar.setAttribute('id', 'pfAppBar');
                document.body.appendChild(this.appBar);
            }

            this.appBar.innerHTML = htmlAppBar;
            // For use in closures, below.
            var self = this;

            jQuery('#pfSignIn').click(function () {
                self.signInOut();
            });

            function onSaveClose() {
                self.toggleAppPanel(false);
                // See if anything needs to be saved.
                if (!self.isDirty()) {
                    self.checkDoc();
                }
                // Save it if it does.
                self.save();
            }

            function onSave() {
                // If this is a first-save or not dirty, pop open the dialog
                // so the user can set the doc title, etc.
                if (self.docid == undefined || self.isSaved()) {
                    self.toggleAppPanel(true);
                    return;
                }
                onSaveClose();
            }

            function onChangeTitle(evt, value) {
                // If the docs not yet saves, we adjust the docid to be a slugified
                // title.
                if (!self.docid && !self.appDialog.hasChanged('docid')) {
                    self.appDialog.setValues({docid: format.slugify(value)});
                }
            }

            function onCopy() {
                self.detach();
                self.toggleAppPanel();
            }

            jQuery('#pfSave').click(onSave);

            self.appPanel = document.createElement('div');
            self.appPanel.setAttribute('id', 'pfAppPanel');
            self.appDialog = new dialog.Dialog({
                fields: [
                    {name: 'message', type: 'message'},
                    {name: 'title', required: true, onChange: onChangeTitle},
                    {name: 'docid', label: "URL ID", required: true},
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
            jQuery(self.appPanel).html(self.appDialog.html());

            // TODO: Make this available to apps not using the appPanel?
            self.errorPanel = document.createElement('div');
            self.errorPanel.setAttribute('id', 'pfErrorPanel');
            self.errorDialog = new dialog.Dialog({
                fields: [
                    {name: 'error', type: 'message'}
                ]
            });
            document.body.appendChild(self.errorPanel);
            jQuery(self.errorPanel).html(self.errorDialog.html());

            jQuery('#pfMore').click(function() {
                self.toggleAppPanel();
            });

            jQuery('#pfUsername').click(function() {
                window.open('http://' + self.wwwHost + '/docs/');
            });

            jQuery('#pfLogo').click(function() {
                window.open('http://' + self.wwwHost);
            });

            jQuery(window).resize(function() {
                self.positionAppPanel();
            });

            this.updateAppBar();
        },

        isAppPanelOpen: function() {
            return this.appPanel && jQuery(this.appPanel).is(':visible');
        },

        toggleAppPanel: function(fOpen) {
            if (!this.appPanel ||
                fOpen != undefined && fOpen == this.isAppPanelOpen()) {
                return;
            }
            var self = this;

            jQuery('#pfMore').toggleClass("expanded collapsed");
            if (this.isAppPanelOpen()) {
                this.positionAppPanel('hide');
                return false;
            } else {
                this.positionAppPanel('show', function() {
                    self.setAppPanelValues(self.meta);
                    self.appDialog.setFocus();
                });
                return true;
            }
        },

        positionAppPanel: function(animation, fnCallback) {
            if (animation == undefined && !this.isAppPanelOpen()) {
                return;
            }
            var ptUR = [dom.getRect(jQuery('#pfAppBarBox')[0])[2], -4];
            dom.slide(this.appPanel, ptUR, animation, fnCallback);
        },

        showError: function(message) {
            if (this.errorPanel == undefined) {
                return;
            }

            var ptUR = [dom.getRect(jQuery('#pfAppBarBox')[0])[2], -4];

            if (message == undefined) {
                dom.slide(this.errorPanel, ptUR, 'hide');
                return;
            }

            this.errorDialog.setValues({'error': message});
            dom.slide(this.errorPanel, ptUR, 'show');

            var self = this;
            function retract() {
                self.showError();
            }
            setTimeout(retract, 3000);
        },

        setAppPanelValues: function(doc) {
            if (this.appPanel == undefined || !this.isAppPanelOpen()) {
                return;
            }
            var values = {};
            // Turn the last-save date to a string.
            values.title = doc.title;
            values.docid = this.ensureDocid(doc.docid);
            values.owner = doc.owner;
            values.modified = format.shortDate(
                format.decodeClass(doc.modified));
            values.tags = format.wordList(doc.tags);
            values.writers = format.wordList(doc.writers);
            values.publicReader = base.indexOf('public', doc.readers) != -1;

            this.appDialog.enableField('message', this.docid == undefined);
            if (this.docid == undefined) {
                values.message = "Before saving, you can choose a new " +
                    "title for your document.";
            }
            this.appDialog.setValues(values);

            this.appDialog.enableField('docid', this.docid == undefined);
            this.appDialog.enableField('copy', this.docid != undefined);
        },

        getAppPanelValues: function() {
            if (this.appPanel == undefined || !this.isAppPanelOpen()) {
                return {};
            }

            var values = {};
            var dlg = this.appDialog.getValues();

            values.title = dlg.title;
            values.docid = dlg.docid;
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

    }); // Client.methods

});
