namespace.module('com.pageforest.editor.textarea', function(exports, require) {

    var visible = false;

    exports.extend({
        createEditor: createEditor,
        loadFile: loadFile,
        adjustHeight: adjustHeight,
        getData: getData,
        view: view
    });

    // hides/shows/returns if visible
    function view(action) {
        if (action == 'show') {
            visible = true;
//            $('#textarea').css('visibility', 'visible');
            $('#textarea').css('display', 'block');
            return true;
        } else if (action == 'hide') {
            visible = false;
//            $('#textarea').css('visibility', 'hidden');
            $('#textarea').css('display', 'none');
            return false;
        } else {
            return visible;
        }
    }

    // Create a textarea and put it in the content div.
    function createEditor() {
        return;
    }

    function loadFile(filename, data) {
//        $('#textarea').css('height', window.innerHeight - 43 + 'px');
//        $('#textarea').css('width', window.innerWidth + 'px');
        var code = $('<textarea id="code" spellcheck="false" autocorrect="off" ></textarea>');
        $('#textarea').empty().append(code);
        code.val(data).focus();
//        code.focus(adjustScroll);
        code.bind('touchstart', adjustScroll);
    }

    function adjustScroll(event) {
        console.log('adjustScroll event: ', event);

    }

    // Make the textarea shorter or longer, after a new file is loaded.
    function adjustHeight(shrink) {
        console.log('adjustHeight() within textarea');
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
        return $('#textarea').find('textarea').val();
    }

});
