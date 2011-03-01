namespace.lookup('com.pageforest.chat').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var dom = namespace.lookup('org.startpad.dom');
    var client;

    var doc;
    var roomid = 'entry';
    var lines = [];

    // Initialize the document - create a client helper object.
    function onReady() {
        doc = dom.bindIDs();
        client = new clientLib.Client(ns);
        client.addAppBar();

        $('#docid').focus();
    }

    // Retrieve the current document state.
    function getDoc() {
        return {
            blob: "Nothing here - see message blob.",
            readers: ["public"],
            writers: ["public"]
        };
    }

    function onMessage(a) {
        for (var i = 0; i < a.length; i++) {
            lines.push(a[i].username + ': ' + a[i].message);
        }
        $('#messages').val(lines.join('\n'));
        dom.scrollToBottom(doc.messages);
    }

    function onSubscribe(message) {
        client.storage.slice(roomid, 'messages', {start: -1}, onMessage);
    }

    // Respond to document load success.
    function setDoc(doc) {
        $('#status').html('Joined chatroom: ' + client.docid);
        roomid = client.docid;
        $('#roomid').val(roomid);
        client.storage.subscribe(roomid, 'messages', {exclusive: true}, onSubscribe);
        client.storage.getBlob(roomid, 'messages', undefined, onMessage);


        $('#document-data').attr('href', '/docs/' + roomid);
        $('#message-data').attr('href', '/docs/' + roomid + '/messages');
    }

    function getDocid() {
        return roomid;
    }

    // Join a chatroom by name.
    // This creates the chatroom if it didn't exist already.
    function join() {
        roomid = $('#roomid').val();
        return false;
    }

    // Send a message to the chat.
    function submit() {
        var data = {
            username: client.username,
            message: $('#message').val()
        };
        client.storage.push(roomid, 'messages', data);
        $('#message').val('').focus();
        return false;
    }

    // Exported functions
    ns.extend({
        onReady: onReady,
        getDoc: getDoc,
        setDoc: setDoc,
        getDocid: getDocid,
        join: join,
        submit: submit
    });

});
