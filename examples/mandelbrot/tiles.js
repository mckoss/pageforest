namespace.lookup('com.pageforest.tiles').defineOnce(function (ns) {
    var format = namespace.lookup('org.startpad.format');

    /* Tiles - Heirarchical image caching library.
     */
    function Tiles(client, docid, dx, dy, rect) {
        this.client = client;
        this.docid = docid;
        this.dxTile = dx;
        this.dyTile = dy;
        this.rect = rect;
        this.listDepth = 4;
        this.tiles = {};
        this.fnRender = function (blobid, fn) {
            var canvas;
            fn(canvas);
        };
        this.fnReleaseCanvas = function (canvas) {};
    }

    Tiles.methods({
        // Calculate a tile name from the tile coordinates and
        // zoom level.  We choose tile prefix naming s.t.
        // childName = parentName + N (for N = 0, 1, 2, 3).
        // The top level tiles are then:
        // '0.png',
        // '00.png', '01.png', '02.png', '03.png',
        // '000.png', '001.png', '002.png', ...
        tileName: function(coord, zoom) {
            var maxTile = Math.pow(2, zoom) - 1;
            if (coord.x < 0 || coord.y < 0 ||
                coord.x > maxTile || coord.y > maxTile) {
                return undefined;
            }
            var name = "";
            var x = coord.x;
            var y = coord.y;
            for (var i = zoom; i > 0; i--) {
                var ix = x % 2;
                var iy = y % 2;
                x = Math.floor(x / 2);
                y = Math.floor(y / 2);
                name = (2 * iy + ix).toString() + name;
            }
            return '0' + name + '.png';
        },

        rectFromTileName: function(tileName) {
            var x = this.rect[0];
            var y = this.rect[1];
            var dx = this.rect[2] - this.rect[0];
            var dy = this.rect[3] - this.rect[1];

            for (var i = 1; i < tileName.length; i++) {
                if (tileName[i] == '.') {
                    break;
                }
                dx /= 2;
                dy /= 2;
                var quad = tileName.charCodeAt(i) - '0'.charCodeAt(0);
                if (quad % 2 == 1) {
                    x += dx;
                }
                if (quad >= 2) {
                    y += dy;
                }
            }
            return [x, y, x + dx, y + dy];
        },

        // Return a DOM img element for the given blobid.
        // The image may not be available in the cache, in which
        // case it will be rendered in the client and then
        // stored in the cache.
        getImage: function(blobid) {
            if (this.tiles[blobid]) {
                return this.tiles[blobid].img;
            }

            var img = document.createElement('img');
            img.style.width = this.dxTile + 'px';
            img.style.height = this.dyTile + 'px';
            img.src = this.client.getDocURL(this.docid, blobid);
            this.tiles[blobid] = {img: img};
            this.checkAndRender(blobid);
            return img;
        },

        // Check if an image exists in the cache.  If not, render it
        // and put it in the cache (and update the DOM image that
        // is displaying it when it is loaded).
        checkAndRender: function(blobid) {
            this.checkTileExists(blobid, function (exists) {
                // Tile already exists - no need to render it.
                if (exists) {
                    return;
                }

                this.fnRender(blobid, function (canvas) {
                    this.checkTileExists(blobid, function (exists) {
                        // Looks like we wasted our time - the tile is
                        // already rendered and stored in a blob by
                        // another client.
                        if (exists) {
                            this.releaseCanvas(canvas);
                            this.updateTileImage(blobid);
                            return;
                        }

                        this.client.putBlob(
                            blobid, format.canvasToPNG(canvas), 'base64',
                            this.docid, function () {
                                this.updateTileImage(blobid);
                            });
                        this.releaseCanvas(canvas);
                    });
                }.fnMethod(this));
            }.fnMethod(this));
        },

        updateTileImage: function (blobid) {
            // Bounce the source field for force a reload of the tile?
            // REVIEW: should we add a random query param?
            var img = this.getImage(blobid);
            img.src = '';
            img.src = this.docid + blobid;
        },

        checkTileExists: function(blobid, fn) {
            // TODO: Load the current tile states using the LIST
            // command using clustered tags.
            var tile = this.tiles[blobid];
            if (tile && tile.exists) {
                fn(true);
                return;
            }

            this.client.getBlob(this.docid, blobid, undefined,
                                function(status) {
                                    fn(status);
                                });
        }
    });

    ns.extend({
        'Tiles': Tiles
    });
});
