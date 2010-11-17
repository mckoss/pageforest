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

        validateArgs: function(funcName, docid, blobid, json, options,
                               fnSuccess) {

            var validations = {
                'no_username': [this.client.username, signInMessage],
                'missing_document_name': [docid, docidMessage],
                'bad_options': [typeof options != 'function',
                                badAPIMessage],
                'bad_callback': [fnSuccess == undefined ||
                                 typeof fnSuccess == 'function',
                                 badAPIMessage]
            };

            if (funcName == 'putDoc') {
                util.extendObject(validations, {
                    'missing_title': [typeof json == 'object' || json.title,
                                      titleMessage],
                    'missing_blob': [typeof json == 'object' || json.blob,
                                     blobMessage]
                });
            }

            if (funcName == 'putDoc' || funcName == 'putBlob') {
                util.extendObject(validations, {
                    'missing_object': [json != undefined, objectMessage]
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
            // TODO: Should call this.storage.getDoc
            $.ajax({
                dataType: 'json',
                url: this.getDocURL(docid),
                error: this.errorHandler.fnMethod(this),
                success: function (doc, textStatus, xmlhttp) {
                    fnSuccess(doc, textStatus, xmlhttp);
                }
            });
        },

        // Write a Blob to storage.
        putBlob: function(docid, blobid, data, options, fnSuccess) {
            if (!this.validateArgs('putBlob', docid, blobid, data, options,
                                   fnSuccess)) {
                return;
            }

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

            if (docid == undefined) {
                this.client.onError('unsaved_document', docUnsavedMessage);
                fnSuccess(false);
                return;
            }

            var url = this.getDocURL(docid) + blobid;
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
        }

        // TODO: LIST command (Blobs and Docs)
        // TODO: DELETE command (Blobs and Docs)

    }); // Storage.methods

    ns.extend({
        'Storage': Storage,
        'jsonToString': jsonToString
    });
});
