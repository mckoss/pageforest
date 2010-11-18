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
    var titleMessage = "Document is missing a title.";
    var blobMessage = "Document is missing a blob property.";
    var invalidJSON = "WARNING: Save object property {key} " +
        "with constructor: {ctor}.";
    var docUnsavedMessage = "Document must be saved before " +
        "children can be saved.";
    var badAPIMessage = "API Call invalid";

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
                    'missing_title': [typeof json == 'object' || json.title,
                                      titleMessage],
                    'missing_blob': [typeof json == 'object' || json.blob,
                                     blobMessage]
                });
            }

            if (funcName.indexOf('put') == 0) {
                util.extendObject(validations, {
                    'missing_object': [json != undefined, objectMessage]
                });
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

            var url = this.getDocURL(docid, blobid);
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
            this.client.log('putBlob: ' + docid + '/' + blobid +
                            (query_string ? '?' + query_string : '') +
                            ' (' + data.length + ' bytes)');
            $.ajax({
                type: 'PUT',
                url: url,
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

        // Read a blob from storage.
        getBlob: function(docid, blobid, options, fnSuccess) {
            if (!this.validateArgs('getBlob', docid, blobid, undefined,
                                   options, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            options = options || {};

            var type = 'GET';
            var url = this.getDocURL(docid, blobid);

            // BUG: transfer-encoding ignored on GET by server?
            if (options.encoding) {
                url += '?transfer-encoding=' + options.encoding;
            }
            if (options.headOnly) {
                type = 'HEAD';
            }
            this.client.log('getBlob: ' + docid + '/' + blobid);
            $.ajax({
                type: type,
                url: url,
                // REVIEW: Is this the right default - note that 200 return
                // codes can return error because the data is NOT json!
                dataType: options.dataType || 'json',
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
                dataType: 'json',
                url: this.getDocURL(docid, blobid) + '?method=delete',
                error: this.errorHandler.fnMethod(this),
                success: function (result, textStatus, xmlhttp) {
                    fnSuccess(result, textStatus, xmlhttp);
                }
            });

        },

        list: function(docid, options, fnSuccess) {
            if (!this.validateArgs('list', docid, undefined, undefined,
                                   options, fnSuccess)) {
                return;
            }
            fnSuccess = fnSuccess || function () {};
            options = options || {};
            var url = this.getDocURL(docid);

            var query_string = [];

            function pushParam(param, value) {
                query_string.push(param + '=' + encodeURIComponent(value));
            }

            pushParam('method', 'list');

            var simpleOptions = ['depth', 'keysonly', 'prefix'];
            for (var i = 0; i < simpleOptions.length; i++) {
                var option = simpleOptions[i];
                if (options[options]) {
                    pushParam(option, options[option]);
                }
            }


            if (options.encoding) {
                pushParam('transfer-encoding', options.encoding);
            }

            if (options.tags) {
                // BUG: I think the server only supports one tag filter...
                pushParam('tag', options.tags.join(','));
            }

            url += '?' + query_string.join('&');

            this.client.log('list: ' + docid +
                            '/ (' + query_string.join(', ') + ')');
            $.ajax({
                url: url,
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
