/* Low-level storage primitives for saving and loading documents
   and blobs.
*/
/*global jQuery $ */
namespace.lookup('com.pageforest.storage').defineOnce(function (ns) {
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');

    var client;

    // Error strings
    var signInMessage = "You must sign in to save a document.";
    var docidMessage = "Document name is missing.";
    var objectMessage = "Document data is missing.";
    var titleMessage = "Document is missing a title.";
    var blobMessage = "Document is missing a blob property.";
    var invalidJSON = "WARNING: Save object property {key} " +
        "with constructor: {ctor}.";
    var docUnsavedMessage = "Document must be saved before " +
        "children can be saved.";

    function setClient(clientT) {
        client = clientT;
    }

    // Return the URL for a document or blob.
    function getDocURL(docid, blobid) {
        if (docid == undefined) {
            return undefined;
        }
        if (blobid == undefined) {
            blobid = '';
        }
        return 'http://' + client.appHost + '/docs/' + docid + '/' + blobid;
    }

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

    function errorHandler(xmlhttp, textStatus, errorThrown) {
        var code = 'ajax_error/' + xmlhttp.status;
        var message = xmlhttp.statusText;
        client.log(message + ' (' + code + ')', {'obj': xmlhttp});
        client.onError(code, message);
    }

    // Save a document to the Pageforest store
    function putDoc(docid, json, fnSuccess) {
        fnSuccess = fnSuccess || function () {};

        var validations = {
            'no_username': [client.username, signInMessage],
            'missing_document_name': [docid, docidMessage],
            'missing_object': [json, objectMessage],
            'missing_title': [json && json.title, titleMessage],
            'missing_blob': [json && json.blob, blobMessage]
        };

        for (var code in validations) {
            if (validations.hasOwnProperty(code)) {
                var validation = validations[code];
                if (!validation[0]) {
                    client.onError(code, validation[1]);
                    return;
                }
            }
        }

        // Default permissions to be public readable.
        if (!json.readers) {
            json.readers = ['public'];
        }

        var data = jsonToString(json);
        client.log('saving document: ' + getDocURL(docid), json);
        $.ajax({
            type: 'PUT',
            url: getDocURL(docid),
            data: data,
            error: errorHandler,
            success: function (result, textStatus, xmlhttp) {
                fnSuccess(result, textStatus, xmlhttp);
            }
        });
    }

    // Save a child blob in the namespace of a document
    function putBlob(docid, blobid, data, options, fnSuccess) {
        fnSuccess = fnSuccess || function () {};
        options = options || {};

        if (docid == undefined) {
            client.onError('unsaved_document', docUnsavedMessage);
            return;
        }

        var url = getDocURL(docid) + blobid;
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
        client.log('saving blob: ' + url + ' (' + data.length + ')');
        $.ajax({
            type: 'PUT',
            url: url,
            data: data,
            dataType: 'json',
            processData: false,
            error: errorHandler,
            success: function() {
                client.log('saved blob: ' + url);
                fnSuccess(true);
            }.fnMethod(this)
        });
    }

    // Read a child blob in the namespace of a document
    // TODO: refactor to share code with putBlob
    function getBlob(docid, blobid, options, fn) {
        fn = fn || function () {};
        options = options || {};
        var type = 'GET';

        if (docid == undefined) {
            client.onError('unsaved_document', docUnsavedMessage);
            fn(false);
            return;
        }

        var url = getDocURL(docid) + blobid;
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
        client.log('reading blob: ' + docid + '/' + blobid);
        $.ajax({
            'type': type,
            'url': url,
            // REVIEW: Is this the right default - note that 200 return
            // codes can return error because the data is NOT json!
            'dataType': options.dataType || 'json',
            'error': function (xmlhttp, textStatus, errorThrown) {
                var code = 'ajax_error/' + xmlhttp.status;
                var message = xmlhttp.statusText;
                client.log(message + ' (' + code + ')', {'obj': xmlhttp});
                client.onError(code, message);
                fn(false);
            }.fnMethod(this),
            'success': function(data) {
                client.log('read blob: ' + url);
                fn(true, data);
            }.fnMethod(this)
        });
    }

    ns.extend({
        'setClient': setClient,
        'putDoc': putDoc,
        'getDoc': function () {
            console.log("NYI");
        },
        'putBlob': putBlob,
        'getBlob': getBlob,
        'getDocURL': getDocURL,
        'jsonToString': jsonToString
    });
});
