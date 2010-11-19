/* Low-level storage primitives for saving and loading documents
   and blobs.
*/
/*global jQuery $ */
namespace.lookup('com.pageforest.storage').defineOnce(function (ns) {
    var base = namespace.lookup('org.startpad.base');
    var util = namespace.util;
    var format = namespace.lookup('org.startpad.format');

    // Error strings
    var signInMessage = "You must sign in to save a document.";
    var noClientMessage = "App error: no client object available.";
    var docidMessage = "Document name is missing.";
    var blobidMessage = "Blobid (key) is missing.";
    var objectMessage = "Document data is missing.";
    var callbackMessage = "Missing callback function.";
    var sliceMessage = "Invalid slice range (start or end value invalid).";
    var titleMessage = "Document is missing a title.";
    var blobMessage = "Document is missing a blob property.";
    var invalidJSON = "WARNING: Save object property {key} " +
        "with constructor: {ctor}.";
    var docUnsavedMessage = "Document must be saved before " +
        "children can be saved.";
    var badAPIMessage = "API Call invalid";

    function Query(url) {
        this.url = url;
        this.params = [];
    }

    // REVIEW: Should this use data:StParams instead?
    Query.methods({
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
            this.client.log(message + ' (' + code + ')', {'obj': xmlhttp});
            this.client.onError(code, message);
        },

        validateArgs: function(funcName, docid, blobid, json,
                               options, fnSuccess) {

            var validations = {
                'no_username': [this.client.username != undefined,
                                signInMessage],
                'bad_options': [typeof options != 'function',
                                badAPIMessage],
                'bad_callback': [fnSuccess == undefined ||
                                 typeof fnSuccess == 'function',
                                 badAPIMessage]
            };

            if (funcName != 'list') {
                util.extendObject(validations, {
                    'missing_document_name': [docid != undefined, docidMessage]
                });
            }

            if (funcName == 'putDoc') {
                util.extendObject(validations, {
                    'missing_title': [typeof json == 'object' && json.title,
                                      titleMessage],
                    'missing_blob': [typeof json == 'object' && json.blob,
                                     blobMessage]
                });
            }

            if (funcName.indexOf('put') == 0) {
                validations['missing_object'] =
                    [json != undefined, objectMessage];
            }

            if (funcName.indexOf('get') == 0 || funcName == 'list' ||
                funcName == 'slice') {
                validations['missing_callback'] =
                    [fnSuccess != undefined, callbackMessage];
            }

            if (funcName == 'slice') {
                validations['slice_range'] =
                    [(options.start == undefined ||
                      typeof options.start == 'number') &&
                     (options.end == undefined ||
                      typeof options.end == 'number'),
                     sliceMessage];
            }

            if (funcName.indexOf('Blob') != -1) {
                util.extendObject(validations, {
                    'missing_blobid': [blobid != undefined, blobidMessage]
                });
            }

            for (var code in validations) {
                if (validations.hasOwnProperty(code)) {
                    var validation = validations[code];
                    if (!validation[0]) {
                        this.client.onError(code, funcName + ': ' +
                                            validation[1]);
                        return false;
                    }
                }
            }

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
            this.client.log('putDoc: ' + docid +
                            ' (' + data.length + ' bytes)');
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
            this.client.log("getDoc: " + docid);
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

            this.client.log("deleteDoc: " + docid);
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
                this.client.onError('unsaved_document', docUnsavedMessage);
                return;
            }

            var url = new Query(this.getDocURL(docid, blobid));
            if (options.encoding) {
                url.push('transfer-encoding', options.encoding);
            }
            if (options.tags) {
                url.push('tags', options.tags.join(','));
            }

            if (typeof data != "string") {
                data = jsonToString(data);
            }

            this.client.log('putBlob: ' + docid + '/' + blobid +
                            '?' + url.params.join(', ') +
                            ' (' + data.length + ' bytes)');
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

            var url = new Query(this.getDocURL(docid, blobid));
            url.push('method', 'push');
            url.push('max', options.max);

            if (docid == undefined) {
                this.client.onError('unsaved_document', docUnsavedMessage);
                return;
            }

            if (typeof json != "string") {
                json = jsonToString(json);
            }

            this.client.log('push: ' + docid + '/' + blobid +
                            ' (' + json.length + ' bytes)');
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

            var url = new Query(this.getDocURL(docid, blobid));
            // BUG: transfer-encoding ignored on GET by server?
            url.push('transfer-encoding', options.encoding);

            var type = 'GET';
            if (options.headOnly) {
                type = 'HEAD';
            }

            this.client.log('getBlob: ' + docid + '/' + blobid);
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
        slice: function(docid, blobid, start, end, fnSuccess) {
            if (!this.validateArgs('slice', docid, blobid, undefined,
                                   {start: start, end: end}, fnSuccess)) {
                return;
            }

            fnSuccess = fnSuccess || function () {};

            var url = new Query(this.getDocURL(docid, blobid));
            url.push('method', 'slice');
            url.push('start', start);
            url.push('end', end);

            this.client.log('slice: ' + docid + '/' + blobid +
                            '[' + (start || '') + ':' +
                            (end || '') + ']');
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

            this.client.log('deleteBlob: ' + docid + '/' + blobid);
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

            if (!this.validateArgs('list', docid, undefined, undefined,
                                   options, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            options = options || {};

            var url = new Query(this.getDocURL(docid, blobid));
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

            this.client.log('list: ' + docid +
                            '/ (' + url.params.join(', ') + ')');
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
        'jsonToString': jsonToString
    });
});
