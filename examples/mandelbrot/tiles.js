namespace.lookup('com.pageforest.tiles').defineOnce(function (ns) {
    var format = namespace.lookup('org.startpad.format');
    var base = namespace.lookup('org.startpad.base');

    /* Tiles - Hierarchical image caching library.
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
        this.fnUpdated = function(blobid, obj) {
        };
    }

    Tiles.methods({
        // Create the (shared) public document into which all tiles
        // will be stored.
        createTileDoc: function() {
            this.client.putDoc(this.docid, {
                title: "Tile Document - " + this.docid,
                writers: ["public"],
                blob: {version: this.docid}
            }, function (saved) {
                if (saved) {
                    alert("Document created!");
                    return;
                }
                alert("Error creating document.");
            });
        },

        // Calculate a tile name from the tile coordinates and
        // zoom level.  We choose tile prefix naming s.t.
        // childName = parentName + N (for N = 0, 1, 2, 3).
        // The top level tiles are then:
        // 0.png
        // 00.png, 01.png
        // 000.png, 001.png, 002.png, 003.png, ...
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

        findParent: function(blobid) {
            // Always assume 0.png is available.
            var quad = blobid.substr(0, blobid.indexOf('.'));
            while (quad.length > 1) {
                quad = quad.slice(0, -1);
                if (this.tiles[quad + '.png']) {
                    break;
                }
            }
            return quad + '.png';
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

        relativeRect: function(tileName, tileOther) {
            var rc = this.rectFromTileName(tileName);
            var rcOther = this.rectFromTileName(tileOther);
            var scale = (rcOther[2] - rcOther[0]) / (rc[2] - rc[0]);
            scale *= this.dxTile;

            rcOther[0] -= rc[0];
            rcOther[1] -= rc[1];
            rcOther[2] -= rc[0];
            rcOther[3] -= rc[1];

            for (var i = 0; i < 4; i++) {
                rcOther[i] = Math.floor(rcOther[i] * scale + 0.5);
            }
            return rcOther;
        },

        getImage: function(blobid) {
            // REVIEW: Should we be caching images?  Could hamper google
            // maps' ability to free space in the browser by dereferencing
            // img objects.
            if (this.tiles[blobid]) {
                return this.tiles[blobid].div;
            }

            this.tiles[blobid] = this.buildTile();
            var parentBlobid = this.findParent(blobid);
            var rcParent = this.relativeRect(blobid, parentBlobid);
            this.setTileSize(this.tiles[blobid].img, rcParent);
            this.tiles[blobid].img.src = this.client.getDocURL(this.docid, parentBlobid);
            this.checkAndRender(blobid);
            return div;
        },

        buildTile: function() {
            var div = document.createElement('div');
            this.setTileSize(div);
            div.style.overflow = 'hidden';
            var img = document.createElement('img');
            div.appendChild(img);
            return {'div': div, 'img': img};
        }

        setTileSize: function(elt, rc) {
            if (rc == undefined) {
                rc = [0, 0, this.dxTile, this.dyTile];
            }
            elt.style.position = 'relative';
            elt.style.left = rc[0];
            elt.style.top = rc[1];
            elt.style.width = (rc[2] - rc[0]) + 'px';
            elt.style.height = (rc[3] - rc[1]) + 'px';
        },

        // Check if an image exists in the cache.  If not, render it
        // and put it in the cache (and update the DOM image that
        // is displaying it when it is loaded).
        checkAndRender: function(blobid) {
            // Save this in closure for use in callbacks, below.
            var self = this;

            self.checkTileExists(blobid, function (exists) {
                var img = self.tiles[blobid];

                // Set the native URL
                if (exists) {
                    self.setTileSize(img);
                    img.src = self.client.getDocURL(self.docid, blobid);
                    self.fnUpdated(blobid, self.tiles[blobid]);
                    return;
                }

                var canvas = document.createElement('canvas');
                canvas.width = self.dxTile;
                canvas.height = self.dyTile;

                self.fnRender(blobid, canvas, function () {
                    // Update the visible tile with the rendered pixels.
                    self.setTileSize(img);
                    img.src = canvas.toDataURL();
                    self.fnUpdated(blobid, self.tiles[blobid]);
                    self.cachePNG(blobid, canvas);
                });
            });
        },

        cachePNG: function(blobid, canvas) {
            var tags = [];
            var tagString = blobid.substr(0, blobid.indexOf('.'));
            for (var level = 1; level <= this.listDepth; level++) {
                tagString = tagString.slice(0, -1);
                if (tagString.length == 0) {
                    break;
                }
                tags.push('p' + level + ':' + tagString);
            }
            self.client.putBlob(this.docid, blobid,
                                format.canvasToPNG(canvas),
                                {'encoding': 'base64', 'tags': tags});
        },

        checkTileExists: function(blobid, fn) {
            // TODO: Load the current tile states using the LIST
            // command using clustered tags.
            var tile = this.tiles[blobid];
            if (tile && tile.exists) {
                fn(true);
                return;
            }

            this.client.getBlob(this.docid, blobid, {dataType: 'text'},
                                function(status) {
                                    if (tile && status) {
                                        tile.exists = true;
                                    }
                                    fn(status);
                                });
        }
    });

    ns.extend({
        'Tiles': Tiles
    });
});
