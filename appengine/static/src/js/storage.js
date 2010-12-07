/* Low-level storage primitives for saving and loading documents
   and blobs.
*/
/*global jQuery, goog $ */
namespace.lookup('com.pageforest.storage').defineOnce(function (ns) {
    var base = namespace.lookup('org.startpad.base');
    var util = namespace.util;
    var format = namespace.lookup('org.startpad.format');
    var loader = namespace.lookup('org.startpad.loader');

    var errorMessages = {
        no_username: "You must sign in to save a document.",
        bad_options: "API Call invalid",
        bad_callback: "API Call invalid",
        slice_range: "Invalid slice range (start or end value invalid).",
        missing_document_name: "Document name is missing.",
        missing_object: "Document data is missing.",
        missing_callback: "Missing callback function.",
        missing_blobid: "Blobid (key) is missing.",
        missing_title: "Document is missing a title.",
        missing_blob: "Document is missing a blob property.",

        invalid_json: "WARNING: Save object property {key} " +
            "with constructor: {ctor}.",
        doc_unsaved: "Document must be saved before " +
            "children can be saved."
    };

    function URL(url) {
        this.url = url;
        this.params = [];
    }

    // REVIEW: Should this use data:StParams instead?
    URL.methods({
        push: function(key, value) {
            if (value != undefined) {
                this.params.push(key + '=' + encodeURIComponent(value));
            }
        },

        toString: function() {
            if (this.params.length == 0) {
                return this.url;
            }
            return this.url + '?' + this.params.join('&');
        }
    });

    function jsonToString(json) {
        var s;
        var badProperty;

        // TODO: Why not map Date properties here?
        // How to unmap Dates on callbacks?
        function mapper(key, value) {
            if (badProperty) {
                return value;
            }
            // Warn about non-generic JavaScript Objects
            if (typeof value == 'object' && value.constructor != Object &&
                value.constructor != Array) {
                console.warn(
                    format.replaceKeys(errorMessages.invalid_json,
                                       {key: key,
                                        ctor:
                                        value.constructor.toString()}));
                badProperty = key;
            }
            return value;
        }

        try {
            s = JSON.stringify(json, mapper);
        } catch (e) {
            // Error probably indicates a circular reference
            console.error(e.message);
            return JSON.stringify({error: e.message});
        }

        return s;
    }

    function getEtag(xmlhttp) {
        var s = xmlhttp.getResponseHeader('ETag');
        // Remove quotes around ETag
        if (s != undefined) {
            s = s.slice(1, -1);
        }

        return s;
    }

    function Storage(client) {
        // We need the client context for Storage functions
        this.client = client;
        this.subscriptions = {};
    }

    Storage.methods({
        // Return the URL for a document or blob.
        getDocURL: function(docid, blobid) {
            docid = docid || '';
            blobid = blobid || '';

            var url = 'http://' + this.client.appHost + '/docs/';

            // Special case for URL for root of all docs
            if (docid == '') {
                return url;
            }

            return url + docid + '/' + blobid;
        },

        errorHandler: function(xmlhttp, textStatus, errorThrown) {
            var code = 'ajax_error/' + xmlhttp.status;
            var message = xmlhttp.statusText;
            this.client.onError(code, message);
        },

        initChannel: function(fnSuccess) {
            fnSuccess = fnSuccess || function () {};

            // Load the required channel api client library
            if (typeof goog == 'undefined' ||
                typeof goog.appengine == 'undefined') {
                loader.loadScript('/_ah/channel/jsapi',
                    this.initChannel.fnMethod(this).fnArgs(fnSuccess));
                return;
            }

            var self = this;
            this.client.onInfo('channel/init', "Intializing new channel.");
            $.ajax({
                url: '/channel/',
                error: this.errorHandler.fnMethod(this),
                success: function (result, textStatus, xmlhttp) {
                    result.expires = new Date().getTime() +
                        1000 * result.lifetime;
                    self.channelInfo = result;
                    self.channel = new goog.appengine.Channel(result.token);
                    self.socket = self.channel.open();
                    self.socket.onmessage = self.onChannel.fnMethod(self);
                    self.socket.onopen = function() {
                        self.client.onInfo('channel/open',
                                           "Channel socket is open.");
                        fnSuccess(self.channelInfo);
                    };
                    self.socket.onclose = function() {
                        self.client.onError('channel/closed',
                            "Realtime messages from PageForest " +
                            "are no longer available.");
                        delete self.channelInfo;
                        delete self.channel;
                        delete self.socket;
                    };
                }
            });
        },

        onChannel: function(evt) {
            // Message format: {app: appId,
            //                  key: key,
            //                  method: string (PUT or PUSH),
            //                  data: {size: number,
            //                         modified: { Date },
            //                         sha1: string
            //                        }
            //                 }
            var message = JSON.parse(evt.data);
            this.client.onInfo('channel/message', message.key +
                            ' (' + message.method + ')');

            var sub = this.subscriptions[message.key];
            if (sub == undefined) {
                this.client.onError('channel/nosub',
                                    "No subscription for channel key: " +
                                    message.key);
                return;
            }
            if (sub.enabled) {
                sub.fn(message);
            }
        },

        subscribe: function(docid, blobid, options, fn) {
            if (!this.validateArgs('subscribe', docid, blobid, undefined,
                                   options, fn)) {
                return;
            }

            options = options || {};
            options.enabled = (fn != undefined);
            options.fn = fn;
            if (fn == undefined) {
                options.enabled = false;
            }

            var key = docid + '/';
            if (blobid != undefined) {
                key += blobid + '/';
            }

            if (options.exclusive) {
                delete options.exclusive;
                this.subscriptions = {};
            }

            // TODO: Remove enabled flag?  Just remove from subscriptions list?
            // BUG: Multiple clients will over-write the channel's subscriptsions
            // since all shared on session!
            var sub = this.subscriptions[key] || {enabled: false};
            var subNew = util.extendObject({}, sub, {enabled: true}, options);
            this.subscriptions[key] = subNew;

            if (sub.enabled != subNew.enabled) {
                this.ensureSubs();
            }
        },

        hasSubscription: function(docid, blobid) {
            var key = docid + '/';
            if (blobid != undefined) {
                key += blobid + '/';
            }
            return this.subscriptions[key] != undefined;
        },

        ensureSubs: function() {
            // Ensure we have a current channel object
            if (this.channelInfo == undefined ||
                this.channelInfo.expires < new Date().getTime()) {
                this.initChannel(this.ensureSubs.fnMethod(this));
                return;
            }

            var self = this;
            $.ajax({
                type: 'PUT',
                url: '/channel/subscriptions',
                dataType: 'json',
                data: jsonToString(this.subscriptions),
                error: this.errorHandler.fnMethod(this),
                success: function (result, textStatus, xmlhttp) {
                    self.client.onInfo('channel/updated',
                                       "Subscriptions updated: " +
                                       base.keys(result.subscriptions).length);
                }
            });
        },

        validateArgs: function(funcName, docid, blobid, json,
                               options, fnSuccess) {

            var blobFuncs = ['getBlob', 'putBlob', 'push', 'slice'];

            var isPutMethod = funcName.indexOf('put') == 0 ||
                funcName == 'push';
            var isBlobMethod = base.indexOf(funcName, blobFuncs) != -1;

            var validations = {
                // Data writing methods need to provide signin and data!
                no_username: !isPutMethod || this.client.username != undefined,
                missing_object: !isPutMethod || json != undefined,

                bad_options: typeof options != 'function',
                bad_callback: fnSuccess == undefined ||
                    typeof fnSuccess == 'function',

                // Only applies to slice method
                slice_range: options == undefined ||
                    (options.start == undefined ||
                     typeof options.start == 'number') &&
                    (options.end == undefined ||
                     typeof options.end == 'number'),

                missing_document_name: funcName == 'list' || docid != undefined,


                // Data reading methods should have a callback function
                missing_callback: isPutMethod || fnSuccess != undefined,

                missing_blobid: !isBlobMethod || blobid != undefined,

                missing_title: funcName != 'putDoc' ||
                    typeof json == 'object' && json.title,
                missing_blob: funcName != 'putDoc' ||
                    typeof json == 'object' && json.blob
            };

            for (var code in validations) {
                if (validations.hasOwnProperty(code)) {
                    var validation = validations[code];
                    if (!validation) {
                        this.client.onError(code, errorMessages[code] +
                                            '(' + funcName + ')');
                        return false;
                    }
                }
            }

            this.client.log(funcName + ': ' + docid +
                            (blobid ? '/' + blobid : ''));

            return true;
        },

        // Save a document to the Pageforest store
        putDoc: function(docid, json, fnSuccess) {
            if (!this.validateArgs('putDoc', docid, undefined, json,
                                   undefined, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};

            // Default permissions to be public readable.
            if (!json.readers) {
                json.readers = ['public'];
            }

            var data = jsonToString(json);
            $.ajax({
                type: 'PUT',
                url: this.getDocURL(docid),
                data: data,
                error: this.errorHandler.fnMethod(this),
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        getDoc: function (docid, fnSuccess) {
            if (!this.validateArgs('getDoc', docid, undefined, undefined,
                                   undefined, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            $.ajax({
                dataType: 'json',
                url: this.getDocURL(docid),
                error: this.errorHandler.fnMethod(this),
                success: function (doc, textStatus, xmlhttp) {
                    fnSuccess(doc, textStatus, xmlhttp);
                }
            });
        },

        deleteDoc: function (docid, fnSuccess) {
            if (!this.validateArgs('deleteDoc', docid, undefined, undefined,
                                   undefined, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};

            $.ajax({
                type: 'PUT',
                dataType: 'json',
                url: this.getDocURL(docid) + '?method=delete',
                error: this.errorHandler.fnMethod(this),
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        // Write a Blob to storage.
        putBlob: function(docid, blobid, data, options, fnSuccess) {
            if (!this.validateArgs('putBlob', docid, blobid, data,
                                   options, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            options = options || {};

            if (docid == undefined) {
                this.client.onError('doc_unsaved',
                                    errorMessages.doc_unsaved);
                return;
            }

            var url = new URL(this.getDocURL(docid, blobid));
            if (options.encoding) {
                url.push('transfer-encoding', options.encoding);
            }
            if (options.tags) {
                url.push('tags', options.tags.join(','));
            }

            if (typeof data != "string") {
                data = jsonToString(data);
            }

            $.ajax({
                type: 'PUT',
                url: url.toString(),
                data: data,
                // BUG: Shouldn't this be type text sometimes?
                dataType: 'json',
                processData: false,
                error: this.errorHandler.fnMethod(this),
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        // Append json to a Blob array.
        push: function(docid, blobid, json, options, fnSuccess) {
            if (!this.validateArgs('push', docid, blobid, json,
                                   options, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            options = options || {};

            var url = new URL(this.getDocURL(docid, blobid));
            url.push('method', 'push');
            url.push('max', options.max);

            if (docid == undefined) {
                this.client.onError('doc_unsaved', errorMessages.doc_unsdaved);
                return;
            }

            if (typeof json != "string") {
                json = jsonToString(json);
            }

            $.ajax({
                type: 'PUT',
                url: url.toString(),
                data: json,
                // BUG: Shouldn't this be type text sometimes?
                dataType: 'json',
                processData: false,
                error: this.errorHandler.fnMethod(this),
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        // Read a blob from storage.
        getBlob: function(docid, blobid, options, fnSuccess) {
            if (!this.validateArgs('getBlob', docid, blobid, undefined,
                                   options, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            options = options || {};

            var url = new URL(this.getDocURL(docid, blobid));
            // BUG: transfer-encoding ignored on GET by server?
            url.push('transfer-encoding', options.encoding);
            url.push('wait', options.wait);
            url.push('etag', options.etag);

            var type = 'GET';
            if (options.headOnly) {
                type = 'HEAD';
            }

            $.ajax({
                type: type,
                url: url.toString(),
                // REVIEW: Is this the right default - note that 200 return
                // codes can return error because the data is NOT json!
                dataType: options.dataType || 'json',
                error: this.errorHandler.fnMethod(this),
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        // Read a blob from storage.
        slice: function(docid, blobid, options, fnSuccess) {
            if (!this.validateArgs('slice', docid, blobid, undefined,
                                   options, fnSuccess)) {
                return;
            }

            fnSuccess = fnSuccess || function () {};

            var url = new URL(this.getDocURL(docid, blobid));
            url.push('method', 'slice');
            url.push('start', options.start);
            url.push('end', options.end);
            url.push('wait', options.wait);
            url.push('etag', options.etag);

            $.ajax({
                url: url.toString(),
                dataType: 'json',
                error: this.errorHandler.fnMethod(this),
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        },

        deleteBlob: function(docid, blobid, fnSuccess) {
            if (!this.validateArgs('deleteBlob', docid, blobid, undefined,
                                   undefined, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};

            $.ajax({
                type: 'PUT',
                dataType: 'json',
                url: this.getDocURL(docid, blobid) + '?method=delete',
                error: this.errorHandler.fnMethod(this),
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });

        },

        list: function(docid, blobid, options, fnSuccess) {
            var simpleOptions = ['depth', 'keysonly', 'prefix', 'tag'];

            if (!this.validateArgs('list', docid, blobid, undefined,
                                   options, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            options = options || {};

            var url = new URL(this.getDocURL(docid, blobid));
            url.push('method', 'list');

            for (var i = 0; i < simpleOptions.length; i++) {
                var option = simpleOptions[i];
                if (options[option] != undefined) {
                    url.push(option, options[option]);
                }
            }
            url.push('transfer-encoding', options.encoding);

            if (options.tags) {
                // BUG: I think the server only supports one tag filter...
                url.push('tag', options.tags.join(','));
            }

            $.ajax({
                url: url.toString(),
                dataType: 'json',
                error: this.errorHandler.fnMethod(this),
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });
        }
    }); // Storage.methods

    ns.extend({
        'Storage': Storage,
        'jsonToString': jsonToString,
        'getEtag': getEtag
    });
});
