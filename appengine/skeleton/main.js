global_namespace.define('com.pageforest.skeleton', function (ns) {

    ns.ready = function () {
        $('#title').focus();
    };

    ns.signin = function () {
        var dot = location.host.indexOf('.');
        var www = "www" + location.host.substr(dot);
        var url = "http://" + www + "/sign-in/skeleton/";
        var tab = window.open(url, '_blank');
    };

    ns.save = function () {
        var url = '/docs/' + $('#name').val();
        var data = JSON.stringify({
            title: $('#title').val(),
            blob: JSON.parse($('#content').val())
        });
        $.ajax({
            type: 'PUT',
            url: url,
            data: data,
            contentType: 'application/json'
        });
    };

    ns.load = function () {
        var url = '/docs/' + $('#name').val();
        $.ajax({
            url: url,
            success: ns.success
        });
    };

    ns.success = function (message, status, xhr) {
        $('#title').val(message.title);
        $('#content').val(message.blob);
    };

});
