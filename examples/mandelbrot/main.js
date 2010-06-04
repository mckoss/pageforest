/*globals google */

namespace.lookup('com.pageforest.mandelbrot.main').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var mandelbrot = namespace.lookup('com.pageforest.mandelbrot');
    var vector = namespace.lookup('org.startpad.vector');
    var format = namespace.lookup('org.startpad.format');
    var tileLib = namespace.lookup('com.pageforest.tiles');

    var tilesDocId = "v6";

    function MandelbrotMapType() {
        this.tileSize = new google.maps.Size(256, 256);
        this.maxZoom = 20;

        this.tiles = new tileLib.Tiles(ns.client, tilesDocId, 256, 256,
                                       ns.m.rcTop);
        this.tiles.fnRender = this.renderTile.fnMethod(this);
    }

    MandelbrotMapType.methods({
        name: "Mandelbrot",
        alt: "Mandelbrot Map Type",

        getTile: function(coord, zoom) {
            var tileName = this.tiles.tileName(coord, zoom);
            if (tileName == undefined) {
                var div = document.createElement('div');
                div.style.width = this.tileSize.width + 'px';
                div.style.height = this.tileSize.height + 'px';
                div.style.backgroundColor = "black";
                return div;
            }

            return this.tiles.getImage(tileName);
        },

        renderTile: function(tileName, canvas, fn) {
            var rc = this.tiles.rectFromTileName(tileName);
            var msStart = new Date().getTime();

            ns.m.render(canvas, rc, function() {
                var ms = new Date().getTime() - msStart;
                var pps = Math.floor(256 * 256 / ms * 1000);
                ns.onError("", "Drawing speed: " +
                           '(' + tileName + ') ' +
                           format.thousands(pps) + " pixels per second.");
                fn();
            });
        }
    });

    function initMap() {
        var mapOptions = {
            zoom: 0,
            center: new google.maps.LatLng(41.850033, -87.6500523),
            mapTypeControlOptions: {
                mapTypeIds: ['mandelbrot'],
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
            }
        };
        ns.map = new google.maps.Map(document.getElementById("map_canvas"),
                                     mapOptions);

        ns.mapType = new MandelbrotMapType();
        ns.map.mapTypes.set('mandelbrot', ns.mapType);
        ns.map.setMapTypeId('mandelbrot');
    }

    // Initialize the document - create a client helper object
    function onReady() {
        ns.client = new clientLib.Client(ns);
        ns.client.setLogging(false);
        ns.m = new mandelbrot.Mandelbrot();
        ns.m.initWorkers();

        ns.m.renderKey($('#level-key')[0]);

        initMap();

        ns.client.poll();
    }

    // This function is called whenever your document should be reloaded.
    function setDoc(json) {
    }

    // Convert your current state to JSON with title and blob properties,
    // these will then be saved to pageforest's storage.
    function getDoc() {
        return {
            "title": "Mandelbrot Set",
            "blob": {
            },
            "readers": ["public"]
        };
    }

    // Called on any api errors.
    function onError(status, message) {
        $('#error').text(message);
    }

    // Called when the current user changes (signs in or out)
    function onUserChange(username) {
        var isSignedIn = username != undefined;
        $('#username').text(isSignedIn ? username : 'anonymous');
        $('#signin').val(isSignedIn ? 'Sign Out' : 'Sign In');
        if (username == "mckoss") {
            $('.admin').show();
        }
    }

    // Sign in (or out) depending on current user state.
    function signInOut() {
        var isSignedIn = ns.client.username != undefined;
        if (isSignedIn) {
            ns.client.signOut();
        }
        else {
            ns.client.signIn();
        }
    }

    function onStateChange(newState, oldState) {
        $('#doc-state').text(newState);
        $('#error').text('');

        // Allow save if doc is dirty OR not bound (yet) to a document.
        if (ns.client.isSaved()) {
            $('#save').attr('disabled', 'disabled');
        }
        else {
            $('#save').removeAttr('disabled');
        }
    }

    // FIXME: Can add an export function eval's symbols in this namespace to
    // export them...add helper to ns?
    // ns.exportSymbols(['onReady', 'getDoc', ... ], function(symbol) {
    //     return eval(symbol);
    // });

    // Exported functions
    ns.extend({
        'onReady': onReady,
        'getDoc': getDoc,
        'setDoc': setDoc,
        'onError': onError,
        'onUserChange': onUserChange,
        'onStateChange': onStateChange,
        'signInOut': signInOut,
        'createBlobDoc': function() {
            ns.mapType.tiles.createTileDoc();
        }
    });

});
