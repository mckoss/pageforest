namespace.lookup('com.pageforest.chess').defineOnce(function (ns) {

    var TILESIZE = 96;
    var FILE_X = {a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8};
    var X_FILE = "_abcdefgh";

    var X_KIND = ['_', 'rook', 'knight', 'bishop', 'queen',
                  'king', 'bishop', 'knight', 'rook'];

    var KIND_LETTER = {king: 'K', queen: 'Q', bishop: 'B',
                       knight: 'N', rook: 'R', pawn: 'P'};

    var LETTER_KIND = {K: 'king', Q: 'queen', B: 'bishop',
                       N: 'knight', R: 'rook', P: 'pawn'};

    var UNICODE = {
        king:   {white: '&#9812;', black: '&#9818;'},
        queen:  {white: '&#9813;', black: '&#9819;'},
        rook:   {white: '&#9814;', black: '&#9820;'},
        bishop: {white: '&#9815;', black: '&#9821;'},
        knight: {white: '&#9816;', black: '&#9822;'},
        pawn:   {white: '&#9817;', black: '&#9823;'}
    };

    var dragging = false;
    var moves = [];
    var tiles = [];
    var pieces = [];


    function makePiece(x, y, player, kind) {
        var piece = $(document.createElement('div'));
        piece.addClass('piece ' + player + ' ' + kind);
        piece.data({x: x, y: y, player: player, kind: kind});
        piece.html(UNICODE[kind][player]);
        piece.css({position: 'absolute',
                   left: (x - 1) * TILESIZE + 'px',
                   top: (8 - y) * TILESIZE + 'px',
                   width: TILESIZE + 'px',
                   height: TILESIZE + 'px',
                   cursor: 'move',
                   'font-size': (2 * TILESIZE / 3) + 'px',
                   'text-align': 'center'});
        piece.bind('mousedown touchstart', ns.touchStart);
        pieces[x][y] = piece;
        return piece;
    }

    function makePieces() {
        var board = $("#board");
        for (var x = 1; x <= 8; x++) {
            board.append(makePiece(x, 8, 'black', X_KIND[x]));
            board.append(makePiece(x, 7, 'black', 'pawn'));
            board.append(makePiece(x, 2, 'white', 'pawn'));
            board.append(makePiece(x, 1, 'white', X_KIND[x]));
        }
    }

    function resetBoard() {
        $('.piece').remove();
        moves = [];
        makePieces();
    }

    function makeBoard() {
        $("html").css({margin: 0, padding: 0});
        $("body").css({margin: 0, padding: 0});
        $(document).bind('mousemove touchmove', ns.touchMove);
        $(document).bind('mouseup touchend touchcancel', ns.touchEnd);
        var style = {width: 8 * TILESIZE + 'px',
                     height: 8 * TILESIZE + 'px',
                     position: 'relative',
                     'float': 'left'};
        var board = $("#board").css(style);
        for (var x = 1; x <= 8; x++) {
            tiles[x] = [null];
            pieces[x] = [null];
            for (var y = 1; y <= 8; y++) {
                var tile = $(document.createElement('div'));
                var shade = (x + y) % 2 ? 'light' : 'dark';
                tile.addClass(shade + ' tile');
                tile.data({x: x, y: y});
                tile.css({
                    position: 'absolute',
                    left: (x - 1) * TILESIZE + 'px',
                    top: (8 - y) * TILESIZE + 'px',
                    width: TILESIZE + 'px',
                    height: TILESIZE + 'px'
                });
                board.append(tile);
                tiles[x][y] = tile;
                pieces[x][y] = null;
            }
        }
    }

    function showLegalCastling(player, xList, y) {
        // Check that the rook is still in the corner.
        var rookX = xList.pop();
        var rook = pieces[rookX][y];
        if (!rook || rook.data('kind') != 'rook' ||
            rook.data('player') != player) {
            return false;
        }
        // Check that all tiles between king and rook are free.
        for (var index = 0; index < xList.length; index++) {
            var x = xList[index];
            if (pieces[x][y]) {
                return false;
            }
        }
        // Mark the king's destination as a legal move.
        tiles[xList[1]][y].addClass('legal');
        return true;
    }

    function showLegalMove(player, x, y, capture) {
        // Don't leap off the board.
        if (x < 1 || x > 8 || y < 1 || y > 8) {
            return false;
        }
        var captured = pieces[x][y];
        var captured_player = captured ? captured.data('player') : '';
        // Don't capture your own pieces.
        if (player == captured_player) {
            return false;
        }
        // Must capture if required.
        if (capture === true && !captured) {
            return false;
        }
        // Must not capture if forbidden.
        if (capture === false && captured) {
            return false;
        }
        // Mark this destination as a legal move.
        tiles[x][y].addClass('legal');
        // Cannot continue after capture.
        if (captured_player) {
            return false;
        }
        return true;
    }

    function showLegalMoves(piece) {
        var player = piece.data('player');
        var kind = piece.data('kind');
        var x = piece.data('x');
        var y = piece.data('y');
        var dx, dy;
        if (player == 'white' && kind == 'pawn') {
            // Diagonal moves must capture.
            showLegalMove(player, x - 1, y + 1, true);
            showLegalMove(player, x + 1, y + 1, true);
            // Straight moves must not capture.
            if (showLegalMove(player, x, y + 1, false) && y == 2) {
                showLegalMove(player, x, y + 2, false);
            }
        }
        if (player == 'black' && kind == 'pawn') {
            // Diagonal moves must capture.
            showLegalMove(player, x - 1, y - 1, true);
            showLegalMove(player, x + 1, y - 1, true);
            // Straight moves must not capture.
            if (showLegalMove(player, x, y - 1, false) && y == 7) {
                showLegalMove(player, x, y - 2, false);
            }
        }
        if (kind == 'knight') {
            for (dy = -2; dy <= 2; dy += 4) {
                for (dx = -1; dx <= 1; dx += 2) {
                    showLegalMove(player, x + dx, y + dy);
                    showLegalMove(player, x + dy, y + dx);
                }
            }
        }
        if (kind == 'queen' || kind == 'rook') {
            for (dx = 1; dx <= 7; dx++) {
                if (!showLegalMove(player, x - dx, y)) {
                    break;
                }
            }
            for (dx = 1; dx <= 7; dx++) {
                if (!showLegalMove(player, x + dx, y)) {
                    break;
                }
            }
            for (dy = 1; dy <= 7; dy++) {
                if (!showLegalMove(player, x, y - dy)) {
                    break;
                }
            }
            for (dy = 1; dy <= 7; dy++) {
                if (!showLegalMove(player, x, y + dy)) {
                    break;
                }
            }
        }
        if (kind == 'queen' || kind == 'bishop') {
            for (dx = 1; dx <= 7; dx++) {
                if (!showLegalMove(player, x - dx, y - dx)) {
                    break;
                }
            }
            for (dx = 1; dx <= 7; dx++) {
                if (!showLegalMove(player, x + dx, y - dx)) {
                    break;
                }
            }
            for (dx = 1; dx <= 7; dx++) {
                if (!showLegalMove(player, x - dx, y + dx)) {
                    break;
                }
            }
            for (dx = 1; dx <= 7; dx++) {
                if (!showLegalMove(player, x + dx, y + dx)) {
                    break;
                }
            }
        }
        if (kind == 'king') {
            for (dy = -1; dy <= 1; dy++) {
                for (dx = -1; dx <= 1; dx++) {
                    if (dx || dy) {
                        showLegalMove(player, x + dx, y + dy);
                    }
                }
            }
            if (player == 'white' && x == 5 && y == 1) {
                showLegalCastling(player, [6, 7, 8], 1);
                showLegalCastling(player, [4, 3, 2, 1], 1);
            }
            if (player == 'black' && x == 5 && y == 8) {
                showLegalCastling(player, [6, 7, 8], 8);
                showLegalCastling(player, [4, 3, 2, 1], 8);
            }
        }
    }

    function pushMove(piece, x1, y1, captured, x2, y2) {
        var kind = piece.data('kind');
        if (kind == 'king' && x1 == 5 && x2 == 7) {
            moves.push('O-O');
            return;
        }
        if (kind == 'king' && x1 == 5 && x2 == 3) {
            moves.push('O-O-O');
            return;
        }
        var move = KIND_LETTER[kind];
        if (move == 'P') {
            move = '';  // P for pawn is omitted.
        }
        move += X_FILE[x1] + y1;
        if (captured) {
            move += 'x';
        }
        move += X_FILE[x2] + y2;
        moves.push(move);
    }

    function castleMove(x1, y1, x2, y2) {
        if (x1 == 5 && x2 == 3) {
            return {x1: 1, y1: y1, x2: 4, y2: y2};
        }
        if (x1 == 5 && x2 == 7) {
            return {x1: 8, y1: y1, x2: 6, y2: y2};
        }
        if (x1 == 3 && x2 == 5) {
            return {x1: 4, y1: y1, x2: 1, y2: y2};
        }
        if (x1 == 7 && x2 == 5) {
            return {x1: 6, y1: y1, x2: 8, y2: y2};
        }
        console.error("Castling error: x1=" + x1 + " x2=" + x2);
        return false;
    }

    function movePiece(piece, x1, y1, x2, y2, animate) {
        var css = {
            left: (x2 - 1) * TILESIZE + 'px',
            top: (8 - y2) * TILESIZE + 'px'
        };
        if (animate) {
            piece.animate(css);
        } else {
            piece.css(css);
        }
        piece.data('x', x2);
        piece.data('y', y2);
        pieces[x1][y1] = null;
        pieces[x2][y2] = piece;
        if (piece.data('kind') == 'king' &&
            y1 == y2 && Math.abs(x2 - x1) == 2) {
            var r = castleMove(x1, y1, x2, y2);
            var rook = pieces[r.x1][r.y1];
            movePiece(rook, r.x1, r.y1, r.x2, r.y2, animate);
        }
    }

    function parseMove(player, move) {
        if (move.substr(0, 3) == 'O-O') {
            var y = player == 'white' ? 1 : 8;
            return {
                kind: 'K',
                x1: 5,
                y1: y,
                captured: false,
                x2: move == 'O-O-O' ? 3 : 7,
                y2: y
            };
        }
        var matches = move.match(/([KQBNRP]?)([a-h])(\d)(x?)([a-h])(\d)/);
        if (!matches) {
            return null;
        }
        return {
            kind: matches[1] || 'P',
            x1: FILE_X[matches[2]],
            y1: parseInt(matches[3], 10),
            captured: !!matches[4],
            x2: FILE_X[matches[5]],
            y2: parseInt(matches[6], 10)
        };
    }

    function redoMove(move, animate) {
        var player = moves.length % 2 ? 'black' : 'white';
        var m = parseMove(player, move);
        if (!m) {
            return false;
        }
        var piece = pieces[m.x1][m.y1];
        if (!piece) {
            console.error("move %s starts on an empty tile", move);
            return false;
        }
        var piece_kind = KIND_LETTER[piece.data('kind')];
        if (m.kind != piece_kind) {
            console.error("move %s expected piece %s, found %s",
                          move, m.kind, piece_kind);
            return false;
        }
        var captured = pieces[m.x2][m.y2];
        if (m.captured && !captured) {
            console.warn("move %s expected capture, not found", move);
        }
        if (captured) {
            captured.remove(); // Remove captured piece from the board.
        }
        pushMove(piece, m.x1, m.y1, m.captured, m.x2, m.y2);
        movePiece(piece, m.x1, m.y1, m.x2, m.y2, animate);
        return true;
    }

    function resurrectPiece(x, y) {
        // Create a piece that was captured here earlier.
        var tile_name = X_FILE[x] + y;
        var player, kind;
        if (y == 8) {
            player = 'black';
            kind = X_KIND[x];
        }
        if (y == 7) {
            player = 'black';
            kind = 'pawn';
        }
        if (y == 2) {
            player = 'white';
            kind = 'pawn';
        }
        if (y == 1) {
            player = 'white';
            kind = X_KIND[x];
        }
        for (var index = moves.length - 1; index >= 0; index--) {
            var move = moves[index];
            if (move.substr(-2) == tile_name) {
                player = moves.length % 2 ? 'white' : 'black';
                kind = LETTER_KIND[move[0]] || 'pawn';
                break;
            }
        }
        if (player && kind) {
            // console.log(x, y, move, player, kind);
            $('#board').append(makePiece(x, y, player, kind));
        } else {
            console.error("could not resurrect piece on %s", tile_name);
        }
    }

    function undoMove(animate) {
        if (!moves.length) {
            return false;
        }
        var move = moves.pop();
        var player = moves.length % 2 ? 'black' : 'white';
        var m = parseMove(player, move);
        if (!m) {
            return false;
        }
        var piece = pieces[m.x2][m.y2];
        if (!piece) {
            console.error("move %s piece not found", move);
            return false;
        }
        var piece_kind = KIND_LETTER[piece.data('kind')];
        if (m.kind != piece_kind) {
            console.error("move %s expected piece %s, found %s",
                          move, m.kind, piece_kind);
            return false;
        }
        var origin = pieces[m.x1][m.y1];
        if (origin) {
            console.error("move %s origin not empty", move);
            return false;
        }
        movePiece(piece, m.x2, m.y2, m.x1, m.y1, animate);
        if (m.captured) {
            resurrectPiece(m.x2, m.y2); // Bring the captured piece back.
        }
        return true;
    }

    function showMoves() {
        var index = 0, html = '';
        while (index < moves.length) {
            var white = moves[index];
            var black = moves[index + 1] || '';
            html = '<tr><td>' + (1 + index / 2) + '.</td><td>' +
                white + '</td><td>' + black + '</td></tr>' + html;
            index += 2;
        }
        $('#moves tbody').html(html);
    }

    function identicalPrefix(array1, array2) {
        var stop = Math.min(array1.length, array2.length);
        for (var index = 0; index < stop; index++) {
            if (array1[index] !== array2[index]) {
                return false;
            }
        }
        return true;
    }

    function updateMoves(moves) {
        if (!identicalPrefix(moves, moves)) {
            resetBoard(); // Replay all moves from a fresh board.
        }
        var animate = Math.abs(moves.length - moves.length) == 1;
        for (var index = moves.length; index < moves.length; index++) {
            redoMove(moves[index], animate);
        }
        while (moves.length > moves.length) {
            undoMove(animate);
        }
        showMoves();
    }

    function pieceStart(e, ui) {
        var piece = $(this);
        // console.log('pieceStart ' + this + ' ' + piece.data('kind'));
        if (piece.hasClass('white') && moves.length % 2 === 1) {
            return false; // Black player's turn, don't move white pieces.
        }
        if (piece.hasClass('black') && moves.length % 2 === 0) {
            return false; // White player's turn, don't move black pieces.
        }
        showLegalMoves(piece);
        return true;
    }

    function pieceStop(e, ui) {
        $('.tile').each(function(index) {
            $(this).removeClass('legal');
        });
    }

    function tileDrop(e, ui) {
        var piece = ui.draggable;
        var tile = $(this);
        if (tile.hasClass('legal')) {
            var x1 = piece.data('x');
            var y1 = piece.data('y');
            var x2 = tile.data('x');
            var y2 = tile.data('y');
            var captured = pieces[x2][y2];
            if (captured) {
                captured.remove(); // Remove captured piece from the board.
            }
            pushMove(piece, x1, y1, captured, x2, y2);
            movePiece(piece, x1, y1, x2, y2, true);
            showMoves();
        } else {
            piece.animate({
                left: (piece.data('x') - 1) * TILESIZE + 'px',
                top: (8 - piece.data('y')) * TILESIZE + 'px'
            });
        }
    }

    function getTouch(e) {
        var touch = e;
        if (e && e.touches && e.touches.length) {
            // Get touch from function argument e.
            // console.log("touch = e.touches[0];");
            touch = e.touches[0];
        } else if (typeof(event) == 'object' && event.touches &&
                   event.touches.length) {
            // Get touch from global variable.
            // console.log("touch = event.touches[0];");
            touch = event.touches[0];
        }
        // console.log('X:' + touch.clientX + ' Y:' + touch.clientY);
        return touch;
    }

    ns.touchStart = function (e) {
        // console.log('touchStart');
        var piece = $(this);
        if (!pieceStart.call(this, e, {draggable: piece})) {
            return true; // This piece should not be moved.
        }
        e.preventDefault(); // Prevent browser scrolling.
        var tile = tiles[piece.data('x')][piece.data('y')];
        var touch = getTouch(e);
        dragging = {piece: piece,
                   tile: tile,
                   offsetX: this.offsetLeft - touch.clientX,
                   offsetY: this.offsetTop - touch.clientY};
        // console.log('touchStart success');
        return false;
    };

    ns.touchMove = function (e) {
        if (!dragging) {
            return true;
        }
        // console.log('touchMove');
        e.preventDefault(); // Prevent browser scrolling.
        var touch = getTouch(e);
        var piece = dragging.piece;
        var left = touch.clientX + dragging.offsetX;
        var top = touch.clientY + dragging.offsetY;
        piece.css('left', left + 'px');
        piece.css('top', top + 'px');
        var x = Math.max(1, Math.min(8, Math.round(1 + left / TILESIZE)));
        var y = Math.max(1, Math.min(8, Math.round(8 - top / TILESIZE)));
        var tile = tiles[x][y];
        if (dragging.tile != tile) {
            dragging.tile.removeClass('illegal');
            if (!tile.hasClass('legal')) {
                tile.addClass('illegal');
            }
            dragging.tile = tile;
        }
        // console.log('touchMove done');
        return false;
    };

    ns.touchEnd = function (e) {
        if (!dragging) {
            return true;
        }
        // console.log('touchEnd');
        e.preventDefault(); // Prevent browser scrolling.
        var piece = dragging.piece;
        var left = parseInt(piece.css('left'), 10);
        var top = parseInt(piece.css('top'), 10);
        dragging.tile.removeClass('illegal');
        tileDrop.call(dragging.tile, e, {draggable: piece});
        pieceStop.call(this, e, {draggable: piece});
        dragging = false;
        // console.log('touchEnd success');
        return false;
    };

    ns.undo = function () {
        undoMove(true);
        showMoves();
    };

    ns.signIn = function () {
        window.open('http://www.pageforest.com/sign-in/chess/', '_blank');
    };

    function onReady() {
        var clientModule = namespace.lookup('com.pageforest.client');
        ns.client = new clientModule.Client(ns);
        makeBoard();
        makePieces();
        // checkAnchor();
        // window.setInterval(checkAnchor, 200); // Five times per second.
        // window.setInterval(loadMoves, 5000); // Every five seconds.
        $(window).mouseup(function() {
            window.getSelection().removeAllRanges();
        });
    }

    function onError(message) {
        console.warn(message);
    }

    function setDoc(doc) {
        updateMoves(doc.blob);
    }

    function getDoc() {
        return {
            readers: ['public'],
            writers: ['public'],
            blob: moves
        };
    }

    ns.extend({
        onReady: onReady,
        onError: onError,
        getDoc: getDoc,
        setDoc: setDoc
    });

}); // com.pageforest.chess
