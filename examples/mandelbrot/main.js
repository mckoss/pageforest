/*globals google */

namespace.lookup('com.pageforest.mandelbrot.main').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var mandelbrot = namespace.lookup('com.pageforest.mandelbrot');
    var vector = namespace.lookup('org.startpad.vector');
    var format = namespace.lookup('org.startpad.format');
    var tileLib = namespace.lookup('com.pageforest.tiles');

    var tilesDocId = "v1";

    function MandelbrotMapType() {
        this.tileSize = new google.maps.Size(256, 256);
        this.maxZoom = 20;

        this.tiles = new tileLib.Tiles(ns.client, tilesDocId, 256, 256);
        this.tiles.setRender(this.renderTile.fnMethod());
    }

    MandelbrotMapType.methods({
        name: "Mandelbrot",
        alt: "Mandelbrot Map Type",

        getTile: function(coord, zoom) {
            var tileName = ns.m.tileName(coord, zoom);
            if (tileName == undefined) {
                var div = document.createElement('div');
                div.style.width = this.tileSize.width + 'px';
                div.style.height = this.tileSize.height + 'px';
                div.style.backgroundColor = "black";
                return div;
            }

            return this.tiles.getImage(tileName);
        }
    });

    function initMap() {
        var mapOptions = {
            zoom: 1,
            center: new google.maps.LatLng(41.850033, -87.6500523),
            mapTypeControlOptions: {
                mapTypeIds: ['mandelbrot'],
                style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
            }
        };
        ns.map = new google.maps.Map(document.getElementById("map_canvas"),
                                     mapOptions);

        ns.map.mapTypes.set('mandelbrot', new MandelbrotMapType());
        ns.map.setMapTypeId('mandelbrot');
    }

    // Create the (shared) public document into which all tiles will be stored.
    function createBlobDoc() {
        ns.client.putDoc(tilesDocId, {
            title: "Mandelbrot Tile Store - Version 1",
            writers: ["public"],
            blob: {
                version: tilesDocId
            }
        }, function (saved) {
            if (saved) {
                alert("Document created!");
                return;
            }
            alert("Error creating document.");
        });
    }

    // Initialize the document - create a client helper object
    function onReady() {
        $('#title').focus();
        ns.viewPort = $('#view-port');
        // I really dislike jQuery's handling of offset().  I should port
        // DOM into the namespace so I don't have to use their stupid
        // wrappers.
        ns.viewPortOffset = ns.viewPort.offset();
        ns.viewPort = ns.viewPort[0];

        $(ns.viewPort).click(function(evt) {
            var px = (evt.pageX - ns.viewPortOffset.left) / ns.viewPort.width;
            var py = (evt.pageY - ns.viewPortOffset.top) / ns.viewPort.height;
            var dx = (px - 0.5) * (ns.m.xMax - ns.m.xMin) / ns.scale;
            var dy = (0.5 - py) * (ns.m.yMax - ns.m.yMin) / ns.scale;
            ns.center[0] += dx;
            ns.center[1] += dy;
            ns.draw();
        });

        ns.m = new mandelbrot.Mandelbrot();
        mandelbrot.initWorkers();

        ns.scale = 1;
        ns.center = [(ns.m.xMin + ns.m.xMax) / 2,
                     (ns.m.yMin + ns.m.yMax) / 2];

        ns.m.renderKey($('#level-key')[0]);

        ns.client = new clientLib.Client(ns);
        ns.client.setLogging();
        // Quick call to poll - don't wait a whole second to try loading
        // the doc and logging in the user.
        ns.client.poll();

        // FIXME: If we are loading a document - no need to draw the
        // default location.
        ns.draw();

        initMap();
    }

    function centerText() {
        var precision = Math.floor(Math.log(ns.scale) / Math.LN10 + 2.5);
        return format.thousands(ns.center[0], precision) + ', ' +
            format.thousands(ns.center[1], precision);
    }

    function draw() {
        $('#center').text(centerText());
        $('#zoom').text(format.thousands(ns.scale));
        ns.onError('ok', "Drawing...");
        setTimeout(function() {
            var msStart = new Date().getTime();
            var dx = (ns.m.xMax - ns.m.xMin) / ns.scale;
            var dy = (ns.m.yMax - ns.m.yMin) / ns.scale;

            function renderComplete() {
                var ms = new Date().getTime() - msStart;
                var pps = Math.floor(ns.viewPort.width * ns.viewPort.height /
                                     ms * 1000);
                ns.onError("", "Drawing speed: " +
                           format.thousands(pps) + " pixels per second.");
            }

            ns.m.render(ns.viewPort,
                        ns.center[0] - dx / 2, ns.center[1] + dy / 2,
                        dx, dy,
                        renderComplete);
        }, 1);
    }

    function zoom(scale) {
        ns.scale *= scale;
        draw();
    }

    // This function is called whenever your document should be reloaded.
    function setDoc(json) {
        ns.scale = json.blob.scale;
        ns.center = json.blob.center;
        ns.draw();
    }

    // Convert your current state to JSON with title and blob properties,
    // these will then be saved to pageforest's storage.
    function getDoc() {
        return {
            "title": "Mandelbrot Location: " + centerText(),
            "blob": {
                'scale': ns.scale,
                'center': ns.center
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

        var url = ns.client.getDocURL() + 'viewport.png';
        var link = $('#viewport-png');
        if (url) {
            link.attr('href', url).show();
        }
        else {
            link.hide();
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
        'draw': draw,
        'zoom': zoom,
        'createBlobDoc': createBlobDoc
    });

});
