global_namespace.define('com.pageforest.scratch', function (ns) {
    var cookies = ns.lookup('com.pageforest.cookies');

    ns.ready = function() {
        $('#doc_id').focus();
        ns.lastHash = location.hash;
        setInterval(ns.poll, 1000);
        if (location.hash) {
            ns.load(location.hash.substr(1));
        }
    };

    ns.poll = function() {
        if (ns.lastHash != location.hash) {
            ns.lastHash = location.hash;
            ns.load(location.hash.substr(1));
        }
        ns.checkUsername();
    };

    ns.checkUsername = function() {
        var sessionkey = cookies.getCookie('sessionkey');
        var username;

        if (sessionkey !== undefined) {
            username = sessionkey.split('/')[1];
        }
        else {
            username = undefined;
        }

        $('#username').text(username || 'anonymous');
        var isSignedIn = (username !== undefined);
        $('#signin').attr('disabled', isSignedIn);
        $('#signout').attr('disabled', !isSignedIn);
    };

    ns.signin = function() {
        var dot = location.host.indexOf('.');
        var www = "www" + location.host.substr(dot);
        var url = "http://" + www + "/sign-in/scratch/";
        window.open(url, '_blank');
    };

    ns.signout = function() {
        document.cookie = 'sessionkey=expired; path=/; expires=' +
            'Sat, 01 Jan 2000 00:00:00 GMT';
    };

    ns.save = function() {
        var data = JSON.stringify({
            title: $('#title').val(),
            blob: $('#blob').val(),
            readers: ['public']
        });
        var docId = $('#name').val();
        $.ajax({
            type: 'PUT',
            url: '/docs/' + docId,
            data: data,
            complete: ns.showStatus,
            success: function(data) {
                location.hash = docId;
            }
        });
    };

    ns.load = function(docid) {
        if (docid) {
            $('#name').val(docid);
        }
        else {
            docid = $('#name').val();
        }
        $.ajax({
            url: '/docs/' + docid,
            complete: ns.showStatus,
            success: function(document) {
                $('#title').val(document.title);
                $('#blob').val(document.blob);
            }
        });
    };

    ns.showStatus = function(ajax, status) {
        var now = new Date();
        var time = now.getHours() + ':' +
            (100 + now.getMinutes()).toString().substr(1) + ':' +
            (100 + now.getSeconds()).toString().substr(1);
        var message = '<div>' + time + ': ' + status;
        message += ' (' + ajax.status + ')';
        message += '</div>';
        $('#results').prepend(message);
    };

});
