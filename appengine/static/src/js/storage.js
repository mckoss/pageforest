/* Low-level storage primitives for saving and loading documents
   and blobs.
*/
/*global jQuery $ */
namespace.lookup('com.pageforest.storage').defineOnce(function (ns) {
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');

    // Error strings
    var signInMessage = "You must sign in to save a document.";
    var noClientMessage = "App error: no client object available.";
    var docidMessage = "Document name is missing.";
    var objectMessage = "Document data is missing.";
    var titleMessage = "Document is missing a title.";
    var blobMessage = "Document is missing a blob property.";
    var invalidJSON = "WARNING: Save object property {key} " +
        "with constructor: {ctor}.";
    var docUnsavedMessage = "Document must be saved before " +
        "children can be saved.";

    function jsonToString(json) {
        var s;
        var badProperty;

        function mapper(key, value) {
            if (badProperty) {
                return value;
            }
            // Warn about non-generic JavaScript Objects
            if (typeof value == 'object' && value.constructor != Object &&
                value.constructor != Array) {
                console.warn(
                    format.replaceKeys(invalidJSON,
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

    function Storage(client) {
        // We need the client context for Storage functions
        this.client = client;
    }

    Storage.methods({
        // Return the URL for a document or blob.
        getDocURL: function(docid, blobid) {
            if (docid == undefined) {
                return undefined;
            }
            if (blobid == undefined) {
                blobid = '';
            }
            return 'http://' + this.client.appHost + '/docs/' +
                docid + '/' + blobid;
        },

        errorHandler: function(xmlhttp, textStatus, errorThrown) {
            var code = 'ajax_error/' + xmlhttp.status;
            var message = xmlhttp.statusText;
            this.client.log(message + ' (' + code + ')', {'obj': xmlhttp});
            this.client.onError(code, message);
        },

        // Save a document to the Pageforest store
        putDoc: function(docid, json, fnSuccess) {
            fnSuccess = fnSuccess || function () {};

            var validations = {
                'no_username': [this.client.username, signInMessage],
                'missing_document_name': [docid, docidMessage],
                'missing_object': [json, objectMessage],
                'missing_title': [json && json.title, titleMessage],
                'missing_blob': [json && json.blob, blobMessage]
            };

            for (var code in validations) {
                if (validations.hasOwnProperty(code)) {
                    var validation = validations[code];
                    if (!validation[0]) {
                        this.client.onError(code, validation[1]);
                        return;
                    }
                }
            }

            // Default permissions to be public readable.
            if (!json.readers) {
                json.readers = ['public'];
            }

            var data = jsonToString(json);
            this.client.log('saving document: ' + this.getDocURL(docid), json);
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

        // Save a child blob in the namespace of a document
        putBlob: function(docid, blobid, data, options, fnSuccess) {
            fnSuccess = fnSuccess || function () {};
            options = options || {};

            if (docid == undefined) {
                this.client.onError('unsaved_document', docUnsavedMessage);
                return;
            }

            var url = this.getDocURL(docid) + blobid;
            var query_string = [];

            function pushParam(param, value) {
                query_string.push(param + '=' + encodeURIComponent(value));
            }

            if (options.encoding) {
                pushParam('transfer-encoding', options.encoding);
            }
            if (options.tags) {
                pushParam('tags', options.tags.join(','));
            }

            query_string = query_string.join('&');
            if (query_string) {
                url += '?' + query_string;
            }

            if (typeof data != "string") {
                data = jsonToString(data);
            }
            this.client.log('saving blob: ' + url + ' (' + data.length + ')');
            var self = this;
            $.ajax({
                type: 'PUT',
                url: url,
                data: data,
                dataType: 'json',
                processData: false,
                error: this.errorHandler.fnMethod(this),
                success: function() {
                    self.client.log('saved blob: ' + url);
                    fnSuccess(true);
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
                this.client.onError('unsaved_document', docUnsavedMessage);
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
            this.client.log('reading blob: ' + docid + '/' + blobid);
            var self = this;
            $.ajax({
                'type': type,
                'url': url,
                // REVIEW: Is this the right default - note that 200 return
                // codes can return error because the data is NOT json!
                'dataType': options.dataType || 'json',
                'error': function (xmlhttp, textStatus, errorThrown) {
                    var code = 'ajax_error/' + xmlhttp.status;
                    var message = xmlhttp.statusText;
                    self.client.log(message + ' (' + code + ')',
                                    {'obj': xmlhttp});
                    self.client.onError(code, message);
                    fn(false);
                }.fnMethod(this),
                'success': function(data) {
                    self.client.log('read blob: ' + url);
                    fn(true, data);
                }.fnMethod(this)
            });
        }

    }); // Storage.methods

    ns.extend({
        'Storage': Storage,
        'jsonToString': jsonToString
    });
});
