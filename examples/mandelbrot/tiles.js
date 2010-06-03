namespace.lookup('com.pageforest.tiles').defineOnce(function (ns) {
    var format = namespace.lookup('org.startpad.format');
    var client = namespace.lookup('com.pageforest.client');

    function Tiles(client, docid, dx, dy) {
        this.client = client;
        this.docid = docid;
        this.dx = dx;
        this.dy = dy;
        this.listDepth = 4;
        this.tiles = {};
        this.fnRender = function (blobid, fn) {
            var canvas;
            fn(canvas);
        };
        this.fnReleaseCanvas = function (canvas) {};
    }

    Tiles.methods({
        getImage: function(blobid) {
            if (this.tiles[blobid]) {
                return this.tiles[blobid].img;
            }

            var img = document.createElement('img');
            img.style.width = this.dx + 'px';
            img.style.height = this.dy + 'px';
            img.src = this.client.getDocURL(this.docid, blobid);
            this.tiles[blobid] = {img: img};
            this.checkAndRender(blobid);
            return img;
        },

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
                            this.client.getDocURL(this.docid, blobid),
                            format.canvasToPNG(canvas),
                            'base64', function () {
                                this.updateTileImage(blobid);
                            });
                        this.releaseCanvas(canvas);
                    });
                });
            });
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

            this.client.getBlog(this.docid, blobid, function(status) {
                fn(status);
            });
        }
    });

});
