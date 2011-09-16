namespace.module('com.pageforest.editor.ace', function(exports, require) {

    var editor;
    var JavascriptMode = window.require('ace/mode/javascript').Mode;
    var CSSMode = window.require('ace/mode/css').Mode;
    var HTMLMode = window.require('ace/mode/html').Mode;
    var XMLMode = window.require('ace/mode/xml').Mode;


    exports.extend({
        createEditor: createEditor,
        removeEditor: removeEditor,
        adjustHeight: adjustHeight,
        getData: getData,
        editor: editor,
        type: 'ace'
    });

    // Create an ace and put it in the content div.
    function createEditor(filename, data) {
        // absolute size the content div for ace
        $('#content').css('height', window.innerHeight - 43 + 'px');
        $('#content').css('width', window.innerWidth + 'px');
        editor = ace.edit('content');
        editor.renderer.$horizScrollAlwaysVisible = false;   // make horiz scrollbar optional

        var lower = filename.toLowerCase();
        if (lower.substr(-5) == '.html') {
            editor.getSession().setMode(new HTMLMode());
        } else if (lower.substr(-4) == '.xml') {
            editor.getSession().setMode(new XMLMode());
        } else if (lower.substr(-3) == '.js' ||
                   lower.substr(-5) == '.json') {
            editor.getSession().setMode(new JavascriptMode());
        } else if (lower.substr(-4) == '.css') {
            editor.getSession().setMode(new CSSMode());
        } else {
            editor.getSession().setMode(new HTMLMode());
        }
        editor.getSession().setValue(data);
    }

    // clear content div of ace classes and necessary sizing
    function removeEditor() {
        $('#content').attr('style', '');
        $('#content').attr('class', '');
    }

    // Make the CodeMirror shorter or longer, after a new file is loaded.
    function adjustHeight(shrink) {
/*        if (!codemirror || !codemirror.editor) {
            return;
        }
        var body = codemirror.editor.container;
        var scrollHeight = body.scrollHeight;
        // var offsetHeight = body.offsetHeight;
        // console.log(body, scrollHeight, offsetHeight);
        var wrapping = $('.CodeMirror-wrapping');
        wrapping.css('height', scrollHeight + 'px');*/
    }

    // Get the edited file content from the editor.
    function getData() {
        return editor.getSession().getValue();
    }

});
