/*global CodeMirror */
namespace.module('com.pageforest.editor.codemirror', function(exports, require) {

    var codemirror;

    exports.extend({
        isProbablySupported: isProbablySupported,
        createEditor: createEditor,
        adjustHeight: adjustHeight,
        getData: getData,
        codemirror: codemirror
    });


    // Guess if the browser supports this editor.
    function isProbablySupported() {
        return CodeMirror.isProbablySupported() &&
            !navigator.userAgent.match(/^Mozilla.5.0 .iPad/);
    }

    // Create a CodeMirror and put it in the content div.
    function createEditor(filename, data) {
        var options = {
            path: '/codemirror/js/',
            width: '100%',
            height: '100px',
            content: data
        };
        var lower = filename.toLowerCase();
        if (lower.substr(-5) == '.html') {
            options.stylesheet = ['/codemirror/css/xmlcolors.css',
                                  '/codemirror/css/jscolors.css',
                                  '/codemirror/css/csscolors.css'];
            options.parserfile = ['parsexml.js',
                                  'parsecss.js',
                                  'tokenizejavascript.js',
                                  'parsejavascript.js',
                                  'parsehtmlmixed.js'];
            options.parser = 'HTMLMixedParser';
        } else if (lower.substr(-4) == '.xml') {
            options.stylesheet = '/codemirror/css/xmlcolors.css';
            options.parserfile = ['parsexml.js'];
            options.parser = 'XMLParser';
        } else if (lower.substr(-3) == '.js' ||
                   lower.substr(-5) == '.json') {
            options.stylesheet = '/codemirror/css/jscolors.css';
            options.parserfile = ['tokenizejavascript.js',
                                  'parsejavascript.js'];
            options.parser = 'JSParser';
        } else if (lower.substr(-4) == '.css') {
            options.stylesheet = '/codemirror/css/csscolors.css';
            options.parserfile = 'parsecss.js';
            options.parser = 'CSSParser';
        } else {
            options.parserfile = 'parsedummy.js';
            options.parser = 'DummyParser';
        }
        var code = $('<textarea id="code"></textarea>');
        $('#content').empty().append(code);
        codemirror = window.CodeMirror.fromTextArea("code", options);
        // codemirror.focus();
    }

    // Make the CodeMirror shorter or longer, after a new file is loaded.
    function adjustHeight(shrink) {
        if (!codemirror || !codemirror.editor) {
            return;
        }
        var body = codemirror.editor.container;
        var scrollHeight = body.scrollHeight;
        // var offsetHeight = body.offsetHeight;
        // console.log(body, scrollHeight, offsetHeight);
        var wrapping = $('.CodeMirror-wrapping');
        wrapping.css('height', scrollHeight + 'px');
    }

    // Get the edited file content from the editor.
    function getData() {
        return codemirror.getCode();
    }

});
