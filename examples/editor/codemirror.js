/*global CodeMirror */

namespace.lookup('com.pageforest.editor.codemirror').define(function (ns) {

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
            height: '400px',
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
        ns.codemirror = window.CodeMirror.fromTextArea("code", options);
        // ns.codemirror.focus();
    }

    // Make the CodeMirror shorter or longer, after a new file is loaded.
    function adjustHeight(shrink) {
        var editor = $('#code');
        var scrollHeight = editor.attr('scrollHeight');
        var offsetHeight = editor.attr('offsetHeight');
        while (shrink && offsetHeight && scrollHeight == offsetHeight) {
            editor.css('height', (offsetHeight / 2) + 'px');
            scrollHeight = editor.attr('scrollHeight');
            offsetHeight = editor.attr('offsetHeight');
        }
        if (scrollHeight > offsetHeight) {
            editor.css('height', scrollHeight + 'px');
        }
    }

    ns.extend({
        isProbablySupported: isProbablySupported,
        createEditor: createEditor,
        adjustHeight: adjustHeight
    });

});
