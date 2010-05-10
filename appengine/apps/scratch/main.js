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
            blob: $('#blob').val()
        });
        $.ajax({
            type: 'PUT',
            url: '/docs/' + $('#name').val(),
            data: data
        });
    };

    ns.load = function() {
        $.ajax({
            url: '/docs/' + $('#name').val(),
            success: function(document) {
                $('#title').val(document.title);
                $('#blob').val(document.blob);
            }
        });
    };

});
