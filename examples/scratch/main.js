namespace.lookup('com.pageforest.examples.scratch').defineOnce(function (ns) {
    var client = namespace.lookup('com.pageforest.client');

    function App() {
        this.client = new client.Client(this);
    }

    function init() {
        ns.app = new App();
        ns.app.client.setLogging();
    }

    App.methods({
        loaded: function (json) {
            $('#title').val(json.title);
            $('#blob').val(json.blob);
            this.status("Loaded.");
        },

        saved: function () {
            this.status("Saved.");
        },

        error: function (status, message) {
            this.status(status + ": " + message);
        },

        status: function (message) {
            $('#results').prepend('<div>' + message +
              '(' +
              client.Client.states.getName(this.client.state) +
              ')' +
              '</div>');
        },

        save: function () {
            var json = {
                'title': $('#title').val(),
                'blob': $('#blob').val()
                };
            this.client.save(json);
        },

        userChanged: function (username) {
            $('#username').text(username);
            var isSignedIn = username != 'anonymous';
            $('#signin').attr('disabled', isSignedIn);
            $('#signout').attr('disabled', !isSignedIn);
        }
    });

    // Exported functions
    ns.extend({
        init: init
    });

});
