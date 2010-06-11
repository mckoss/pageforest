namespace.lookup('com.pageforest.tiles.test').defineOnce(function (ns) {
    var tiles = namespace.lookup('com.pageforest.tiles');
    var clientLib = namespace.lookup('com.pageforest.client');
    var base = namespace.lookup('org.startpad.base');

    var nsSymbols = ['Tiles',
                     '_isDefined', '_referenced', '_parent', '_path', 'test'];

    var tilesSymbols = ['tileName', 'rectFromTileName', 'getImage',
                        'checkAndRender', 'checkTileExists', 'createTileDoc',
                        'findParent', 'relativeRect', 'buildTile',
                        'copyTileAttrs', 'cachePNG', 'setTileSize',
                        'setTileExists', 'pixelRect'];

    function addTests(ts) {
        ts.addTest("Contract", function (ut) {
            var Tiles = tiles.Tiles;
            ut.assertEq(typeof(Tiles), 'function');

            for (var i = 0; i < tilesSymbols.length; i++) {
                var symbol = tilesSymbols[i];
                ut.assert(Tiles.prototype[symbol] != undefined,
                          "Missing api: Tiles." + symbol);
                ut.assertEq(typeof Tiles.prototype[symbol], 'function',
                            symbol);
            }
        });

        ts.addTest("Undocumented Exports", function (ut) {
            var Tiles = tiles.Tiles;
            for (var prop in tiles) {
                if (tiles.hasOwnProperty(prop)) {
                    ut.assert(nsSymbols.indexOf(prop) != -1,
                                "Undocumented symbol: " + prop);
                }
            }

            for (prop in Tiles.prototype) {
                if (Tiles.prototype.hasOwnProperty(prop)) {
                    ut.assert(tilesSymbols.indexOf(prop) != -1,
                              "Undocument method: Tiles." + prop);
                }
            }
        });

        ts.addTest("tileName", function (ut) {
            var t = new tiles.Tiles();
            var tests = [
                [{x: 0, y: 0}, 0, "0.png"],
                [{x: 0, y: 1}, 0, undefined],
                [{x: 2, y: 0}, 1, undefined],
                [{x: -5, y: 0}, 1, undefined],
                [{x: 20, y: 1}, 4, undefined],
                [{x: 0, y: 0}, 2, "000.png"],
                [{x: 1, y: 0}, 2, "001.png"],
                [{x: 0, y: 1}, 2, "002.png"],
                [{x: 1, y: 1}, 2, "003.png"],
                [{x: 2, y: 2}, 2, "030.png"],
                [{x: 3, y: 3}, 2, "033.png"],
                [{x: 3, y: 0}, 2, "011.png"],
                [{x: 0, y: 3}, 2, "022.png"]
            ];

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(t.tileName(test[0], test[1]), test[2], i);
            }

        });

        ts.addTest("rectFromTileName", function (ut) {
            var client = new clientLib.Client({getDoc: function () {
                return {};
            }});
            var t = new tiles.Tiles(client, 'v1', 256, 256,
                                    [-2, -2, 2, 2]);
            var tests = [
                ["0.png", [-2, -2, 2, 2]],
                ["00.png", [-2, -2, 0, 0]],
                ["01.png", [0, -2, 2, 0]],
                ["02.png", [-2, 0, 0, 2]],
                ["03.png", [0, 0, 2, 2]]
            ];

            for (var i = 0; i < tests.length; i++) {
                var test = tests[i];
                ut.assertEq(t.rectFromTileName(test[0]), test[1], i);
            }
        });

        ts.addTest("relativeRect", function(ut) {
            var client = new clientLib.Client({getDoc: function () {
                return {};
            }});
            var t = new tiles.Tiles(client, 'v1', 256, 256,
                                    [-2, -2, 2, 2]);

            var rc = t.relativeRect('0.png', '00.png');
            ut.assertEq(rc, [0, 0, 128, 128]);
        });

        ts.addTest("getImage", function(ut) {
            var client = new clientLib.Client({getDoc: function () {
                return {};
            }});
            var t = new tiles.Tiles(client, 'v1', 256, 256,
                                    [-2, -2, 2, 2]);

            var div = t.getImage("0.png");
            ut.assertEq(div.tagName, 'DIV');

            // You can't measure the elements until they are added to
            // the document.
            ut.assertEq(div.offsetWidth, 0);
            document.body.appendChild(div);
            ut.assertEq(div.offsetWidth, 256, 'div width');
            ut.assertEq(div.offsetHeight, 256, 'div height');
            var img = div.firstChild;
            ut.assertEq(img.tagName, 'IMG');
            ut.assertEq(img.offsetWidth, 256, 'img width');
            ut.assertEq(img.offsetHeight, 256, 'img height');


            div = t.getImage("01.png");
            ut.assertEq(div.tagName, 'DIV');

            // You can't measure the elements until they are added to
            // the document.
            ut.assertEq(div.offsetWidth, 0);
            document.body.appendChild(div);
            ut.assertEq(div.offsetWidth, 256, 'div width');
            ut.assertEq(div.offsetHeight, 256, 'div height');
            img = div.firstChild;
            ut.assertEq(img.tagName, 'IMG');
            ut.assertEq(img.offsetWidth, 512, 'img width');
            ut.assertEq(img.offsetHeight, 512, 'img height');
        });

        ts.addTest("findParent", function(ut) {
            var client = new clientLib.Client({getDoc: function () {
                return {};
            }});
            var t = new tiles.Tiles(client, 'v1', 256, 256,
                                    [-2, -2, 2, 2]);

            ut.assertEq(t.findParent('01.png'), '0.png');
            ut.assertEq(t.findParent('013.png'), '0.png');
            t.getImage('01.png');
            t.setTileExists('01.png');
            ut.assertEq(t.findParent('013.png'), '01.png');
        });
    }

    ns.addTests = addTests;
});
