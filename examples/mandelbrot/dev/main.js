/* Mandelbrot Pageforest Demo

   Use Google Maps to navigate the Mandelbrot set at multiple levels of
   resolution.

   Features:

   - Client side rendering using the Canvas element.
   - Cache image tiles to Pageforest Blob storage.
   - Render using background processing using Web Workers including
     multiple concurrent workers (TBD).

   TODO:

   * Don't render positive tile space (just flip tiles to display). Note
     should change to render from center of each pixel, rather than
   * Show low-resolution images in the map until the high res tile
     is available (use clipped/enlarged sections from parent tiles.
     the corner to not introduce distortion around the origin.
   * Render priority to visible/central tiles (not FIFO order as is done now).
   * Pick better starting location.  Make outer regions be transparent
     rather than black.
   * Full-screen mode.
   * Support bookmarking of interesting areas of the set - thumbnails
     in the document.  Animated tours of the space.
   * Let users build large mosaic images of selected reagions and store them
     in their own document space (integrate with ordering print outs and
     merchandise).
   * Graph CPU and Network usage (both raw pixels per second and total
     pixels per second to show effect of multiple CPU cores).
   * Don't roundtrip for cached URL tile after a PUT - just use the computed
     data: url from canvas to display directly.
   * Allow anonymous users to render offline (only - mode for speed test).
   * Use concurrent viewers as bot-net for parrallel computation of requested
     tiles.
   - Allow the wuser to select the number of concurrent workers (0-16).
   - Allow selection of different level colorings.
   - Hot-spot overlay - show where (recent) users are viewing the set.
     Possible just show time-decay viewing and/or rendering.
   - Coordinates/grid overlay.  Also hover to show tile name?
   - Leaderboard for renderers (max throughput and total recent work).
   - User (public) comments in the set.  Star regions - show most recently
     popular.
   - Display total number of tiles created over time, number of concurrent
     viewers and renderers.  Allow users to join teams and have team
     leaderboard. See http://setiathome.berkeley.edu/top_teams.php and
     http://boinc.berkeley.edu/.
 */

/*globals google */

namespace.lookup('com.pageforest.mandelbrot.main').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var mandelbrot = namespace.lookup('com.pageforest.mandelbrot');
    var vector = namespace.lookup('org.startpad.vector');
    var format = namespace.lookup('org.startpad.format');
    var tileLib = namespace.lookup('com.pageforest.tiles');

    var tilesDocId = "v7";

    function MandelbrotMapType() {
        this.tileSize = new google.maps.Size(256, 256);
        this.maxZoom = 20;

        this.tiles = new tileLib.Tiles(ns.client, tilesDocId, 256, 256,
                                       ns.m.rcTop);
        this.tiles.fnRender = this.renderTile.fnMethod(this);
        // Keep track of our flipTiles - to update when the original
        // is rendered.
        this.flipTiles = {};
    }

    MandelbrotMapType.methods({
        name: "Mandelbrot",
        alt: "Mandelbrot Map Type",

        getTile: function(coord, zoom) {
            var flip = false;
            var y = coord.y;
            var yMax = Math.pow(2, zoom);
            var div;

            // Only render tiles in the "Northern Hemisphere"
            if (y >= yMax / 2) {
                flip = true;
                y = (yMax - 1) - y;
            }

            var tileName = this.tiles.tileName({x: coord.x, y: y}, zoom);
            if (tileName == undefined) {
                div = document.createElement('div');
                div.style.width = this.tileSize.width + 'px';
                div.style.height = this.tileSize.height + 'px';
                return div;
            }

            if (tileName[1] == '2' || tileName[1] == '3') {
                throw new Error("Never ask for southern hemisphere tiles!");
            }

            var img = this.tiles.getImage(tileName);
            if (flip) {
                var imgFlip = img.cloneNode();
                $(imgFlip).addClass('flip');
                this.flipTiles[tileName] = imgFlip;
                return imgFlip;
            }
            return img;
        },

        renderTile: function(tileName, canvas, fn) {
            var rc = this.tiles.rectFromTileName(tileName);
            var self = this;
            ns.m.render(canvas, rc, function() {
                if (self.flipTiles[tileName]) {
                    self.flipTiles[tileName].src = canvas.toDataURL();
                }
                fn();
            });
        }
    });

    function initMap() {
        var mapOptions = {
            zoom: 2,
            center: new google.maps.LatLng(0, -40),
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

        var key = $('#level-key')[0];
        if (key) {
            ns.m.renderKey(key);
        }

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
        if (username == "mckoss" || username == "jcrocholl") {
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
