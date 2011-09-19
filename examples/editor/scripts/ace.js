namespace.module('com.pageforest.editor.ace', function(exports, require) {

    var editor;
    var visible = false;
    var JavascriptMode = window.require('ace/mode/javascript').Mode;
    var JSONMode = window.require('ace/mode/javascript').Mode;
    var CSSMode = window.require('ace/mode/css').Mode;
    var HTMLMode = window.require('ace/mode/html').Mode;
    var XMLMode = window.require('ace/mode/xml').Mode;

    exports.extend({
        createEditor: createEditor,
        loadFile: loadFile,
        adjustHeight: adjustHeight,
        getData: getData,
        editor: editor,
        view: view
    });

    // hides/shows/returns if visible
    function view(action) {
        if (action == 'show') {
            visible = true;
            $('#ace').css('visibility', 'visible');
//            $('#ace').css('display', 'block');
            return true;
        } else if (action == 'hide') {
            visible = false;
            $('#ace').css('visibility', 'hidden');
//            $('#ace').css('display', 'none');
            return false;
        } else {
            return visible;
        }
    }

    // Create an ace and put it in the content div.
    function createEditor() {
        $('#ace').css('height', window.innerHeight - 43 + 'px');
        $('#ace').css('width', window.innerWidth + 'px');
        editor = ace.edit('ace');
        editor.renderer.$horizScrollAlwaysVisible = false;   // make horiz scrollbar optional
    }

    function loadFile(filename, data) {
        var lower = filename.toLowerCase();
        if (lower.substr(-5) == '.html') {
            editor.getSession().setMode(new HTMLMode());
        } else if (lower.substr(-4) == '.xml') {
            editor.getSession().setMode(new XMLMode());
        } else if (lower.substr(-3) == '.js') {
            editor.getSession().setMode(new JavascriptMode());
        } else if (lower.substr(-5) == '.json') {
            editor.getSession().setMode(new JSONMode());
        } else if (lower.substr(-4) == '.css') {
            editor.getSession().setMode(new CSSMode());
        } else {
            editor.getSession().setMode(new HTMLMode());
        }
        editor.getSession().setValue(data);
    }

    // Make the CodeMirror shorter or longer, after a new file is loaded.
    function adjustHeight(shrink) {
        console.log('adjustHeight() from ace');
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
