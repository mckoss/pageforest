namespace.module('com.pageforest.editor.textarea', function(exports, require) {

    exports.extend({
        createEditor: createEditor,
        adjustHeight: adjustHeight,
        getData: getData
    });

    // Create a textarea and put it in the content div.
    function createEditor(filename, data) {
        var code = $('<textarea id="code"></textarea>');
        $('#content').empty().append(code);
        code.val(data).focus();
    }

    // Make the textarea shorter or longer, after a new file is loaded.
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

    // Get the edited file content from the textarea.
    function getData() {
        return $('textarea').val();
    }

});
