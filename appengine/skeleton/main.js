global_namespace.define('com.pageforest.skeleton', function (ns) {

    ns.ready = function() {
        $('#title').focus();
    };

    ns.signin = function() {
        var dot = location.host.indexOf('.');
        var www = "www" + location.host.substr(dot);
        var url = "http://" + www + "/sign-in/skeleton/";
        var tab = window.open(url, '_blank');
    };

    ns.save = function() {
        var data = '{"title": "' + $('#title').val() + '",' +
            '"blob": ' + $('#content').val() + '}';
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
                $('#content').val(document.blob);
            }
        });
    };

});
