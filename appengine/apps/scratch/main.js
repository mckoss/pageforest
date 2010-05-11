global_namespace.define('com.pageforest.scratch', function (ns) {

    ns.ready = function() {
        $('#doc_id').focus();
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
        $.ajax({
            type: 'PUT',
            url: '/docs/' + $('#name').val(),
            data: data,
            complete: ns.showStatus,
            success: function(data) {
                alert(JSON.stringify(data, undefined, 4));
            }
        });
    };

    ns.load = function() {
        $.ajax({
            url: '/docs/' + $('#name').val(),
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
        message = '<div>' + time + ': ' + status;
        message += ' (' + ajax.status + ')';
        message += '</div>';
        $('#results').prepend(message);
    };

});
