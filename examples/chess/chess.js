/*global window, document, console, event, $ */
/*jslint onevar: false, plusplus: false, bitwise: false,
  white: false, eqeqeq: false, forin: true, maxlen: 78 */

var Chess = {
    tileSize: 80,
    anchor: '',
    drag: false,
    moves: [],
    tiles: [],
    pieces: [],
    fileX: {a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8},
    xFile: "_abcdefgh"
};

Chess.xKind = ['_', 'rook', 'knight', 'bishop', 'queen',
               'king', 'bishop', 'knight', 'rook'];

Chess.kindLetter = {king: 'K', queen: 'Q', bishop: 'B',
                    knight: 'N', rook: 'R', pawn: 'P'};

Chess.letterKind = {K: 'king', Q: 'queen', B: 'bishop',
                    N: 'knight', R: 'rook', P: 'pawn'};

Chess.unicode = {
    king:   {white: '&#9812;', black: '&#9818;'},
    queen:  {white: '&#9813;', black: '&#9819;'},
    rook:   {white: '&#9814;', black: '&#9820;'},
    bishop: {white: '&#9815;', black: '&#9821;'},
    knight: {white: '&#9816;', black: '&#9822;'},
    pawn:   {white: '&#9817;', black: '&#9823;'}
};

Chess.randomUUID = function(len, radix) {
    // Adapted from http://www.broofa.com/Tools/Math.uuid.js
    var chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    var uuid = [];
    radix = radix || chars.length;
    for (var i = 0; i < len; i++) {
        uuid[i] = chars[0 | Math.random() * radix];
    }
    return uuid.join('');
};

Chess.showLegalCastling = function(player, xList, y) {
    // Check that the rook is still in the corner.
    var rookX = xList.pop();
    var rook = Chess.pieces[rookX][y];
    if (!rook) { return false; }
    if (rook.data('kind') != 'rook') { return false; }
    if (rook.data('player') != player) { return false; }
    // Check that all tiles between king and rook are free.
    for (var index in xList) {
        var x = xList[index];
        if (Chess.pieces[x][y]) { return false; }
    }
    // Mark the king's destination as a legal move.
    Chess.tiles[xList[1]][y].addClass('legal');
    return true;
};

Chess.showLegalMove = function(player, x, y, capture) {
    // Don't leap off the board.
    if (x < 1 || x > 8 || y < 1 || y > 8) { return false; }
    var captured = Chess.pieces[x][y];
    var captured_player = captured ? captured.data('player') : '';
    // Don't capture your own pieces.
    if (player == captured_player) { return false; }
    // Must capture if required.
    if (capture === true && !captured) { return false; }
    // Must not capture if forbidden.
    if (capture === false && captured) { return false; }
    // Mark this destination as a legal move.
    Chess.tiles[x][y].addClass('legal');
    // Cannot continue after capture.
    if (captured_player) { return false; }
    return true;
};

Chess.showLegalMoves = function(piece) {
    var player = piece.data('player');
    var kind = piece.data('kind');
    var x = piece.data('x');
    var y = piece.data('y');
    var dx, dy;
    if (player == 'white' && kind == 'pawn') {
        // Diagonal moves must capture.
        Chess.showLegalMove(player, x - 1, y + 1, true);
        Chess.showLegalMove(player, x + 1, y + 1, true);
        // Straight moves must not capture.
        if (Chess.showLegalMove(player, x, y + 1, false) && y == 2) {
            Chess.showLegalMove(player, x, y + 2, false);
        }
    }
    if (player == 'black' && kind == 'pawn') {
        // Diagonal moves must capture.
        Chess.showLegalMove(player, x - 1, y - 1, true);
        Chess.showLegalMove(player, x + 1, y - 1, true);
        // Straight moves must not capture.
        if (Chess.showLegalMove(player, x, y - 1, false) && y == 7) {
            Chess.showLegalMove(player, x, y - 2, false);
        }
    }
    if (kind == 'knight') {
        for (dy = -2; dy <= 2; dy += 4) {
            for (dx = -1; dx <= 1; dx += 2) {
                Chess.showLegalMove(player, x + dx, y + dy);
                Chess.showLegalMove(player, x + dy, y + dx);
            }
        }
    }
    if (kind == 'queen' || kind == 'rook') {
        for (dx = 1; dx <= 7; dx++) {
            if (!Chess.showLegalMove(player, x - dx, y)) { break; }
        }
        for (dx = 1; dx <= 7; dx++) {
            if (!Chess.showLegalMove(player, x + dx, y)) { break; }
        }
        for (dy = 1; dy <= 7; dy++) {
            if (!Chess.showLegalMove(player, x, y - dy)) { break; }
        }
        for (dy = 1; dy <= 7; dy++) {
            if (!Chess.showLegalMove(player, x, y + dy)) { break; }
        }
    }
    if (kind == 'queen' || kind == 'bishop') {
        for (dx = 1; dx <= 7; dx++) {
            if (!Chess.showLegalMove(player, x - dx, y - dx)) { break; }
        }
        for (dx = 1; dx <= 7; dx++) {
            if (!Chess.showLegalMove(player, x + dx, y - dx)) { break; }
        }
        for (dx = 1; dx <= 7; dx++) {
            if (!Chess.showLegalMove(player, x - dx, y + dx)) { break; }
        }
        for (dx = 1; dx <= 7; dx++) {
            if (!Chess.showLegalMove(player, x + dx, y + dx)) { break; }
        }
    }
    if (kind == 'king') {
        for (dy = -1; dy <= 1; dy++) {
            for (dx = -1; dx <= 1; dx++) {
                if (dx || dy) { Chess.showLegalMove(player, x + dx, y + dy); }
            }
        }
        if (player == 'white' && x == 5 && y == 1) {
            Chess.showLegalCastling(player, [6, 7, 8], 1);
            Chess.showLegalCastling(player, [4, 3, 2, 1], 1);
        }
        if (player == 'black' && x == 5 && y == 8) {
            Chess.showLegalCastling(player, [6, 7, 8], 8);
            Chess.showLegalCastling(player, [4, 3, 2, 1], 8);
        }
    }
};

Chess.pieceStart = function(e, ui) {
    var piece = $(this);
    // console.log('pieceStart ' + this + ' ' + piece.data('kind'));
    if (piece.hasClass('white') && Chess.moves.length % 2 === 1) {
        return false; // Black player's turn, don't move white pieces.
    }
    if (piece.hasClass('black') && Chess.moves.length % 2 === 0) {
        return false; // White player's turn, don't move black pieces.
    }
    Chess.showLegalMoves(piece);
    return true;
};

Chess.pieceStop = function(e, ui) {
    $('.tile').each(function(index) {
        $(this).removeClass('legal');
    });
};

Chess.getTouch = function(e) {
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
    // console.log('clientX:' + touch.clientX + ' clientY:' + touch.clientY);
    return touch;
};

Chess.touchStart = function(e) {
    // console.log('touchStart');
    var piece = $(this);
    if (!Chess.pieceStart.call(this, e, {draggable: piece})) {
        return true; // This piece should not be moved.
    }
    e.preventDefault(); // Prevent browser scrolling.
    var tile = Chess.tiles[piece.data('x')][piece.data('y')];
    var touch = Chess.getTouch(e);
    Chess.drag = {piece: piece,
                  tile: tile,
                  offsetX: this.offsetLeft - touch.clientX,
                  offsetY: this.offsetTop - touch.clientY};
    // console.log('touchStart success');
    return false;
};

Chess.touchMove = function(e) {
    if (!Chess.drag) { return true; }
    // console.log('touchMove');
    e.preventDefault(); // Prevent browser scrolling.
    var touch = Chess.getTouch(e);
    var piece = Chess.drag.piece;
    var left = touch.clientX + Chess.drag.offsetX;
    var top = touch.clientY + Chess.drag.offsetY;
    piece.css('left', left + 'px');
    piece.css('top', top + 'px');
    var x = Math.max(1, Math.min(8, Math.round(1 + left / Chess.tileSize)));
    var y = Math.max(1, Math.min(8, Math.round(8 - top / Chess.tileSize)));
    var tile = Chess.tiles[x][y];
    if (Chess.drag.tile != tile) {
        Chess.drag.tile.removeClass('illegal');
        if (!tile.hasClass('legal')) { tile.addClass('illegal'); }
        Chess.drag.tile = tile;
    }
    // console.log('touchMove done');
    return false;
};

Chess.touchEnd = function(e) {
    if (!Chess.drag) { return true; }
    // console.log('touchEnd');
    e.preventDefault(); // Prevent browser scrolling.
    var piece = Chess.drag.piece;
    var left = parseInt(piece.css('left'), 10);
    var top = parseInt(piece.css('top'), 10);
    Chess.drag.tile.removeClass('illegal');
    Chess.tileDrop.call(Chess.drag.tile, e, {draggable: piece});
    Chess.pieceStop.call(this, e, {draggable: piece});
    Chess.drag = false;
    // console.log('touchEnd success');
    return false;
};

Chess.tileDrop = function(e, ui) {
    var piece = ui.draggable;
    var tile = $(this);
    if (tile.hasClass('legal')) {
        var x1 = piece.data('x');
        var y1 = piece.data('y');
        var x2 = tile.data('x');
        var y2 = tile.data('y');
        var captured = Chess.pieces[x2][y2];
        if (captured) {
            captured.remove(); // Remove captured piece from the board.
        }
        Chess.pushMove(piece, x1, y1, captured, x2, y2);
        Chess.movePiece(piece, x1, y1, x2, y2, true);
        Chess.showMoves();
        Chess.saveMoves();
    } else {
        piece.animate({
            left: (piece.data('x') - 1) * Chess.tileSize + 'px',
            top: (8 - piece.data('y')) * Chess.tileSize + 'px'});
    }
};

Chess.pushMove = function(piece, x1, y1, captured, x2, y2) {
    var kind = piece.data('kind');
    if (kind == 'king' && x1 == 5 && x2 == 7) {
        Chess.moves.push('O-O');
        return;
    }
    if (kind == 'king' && x1 == 5 && x2 == 3) {
        Chess.moves.push('O-O-O');
        return;
    }
    var move = Chess.kindLetter[kind];
    if (move == 'P') { move = ''; } // P for pawn is omitted.
    move += Chess.xFile[x1] + y1;
    if (captured) { move += 'x'; }
    move += Chess.xFile[x2] + y2;
    Chess.moves.push(move);
};

Chess.showMoves = function() {
    var index = 0, html = '';
    while (index < Chess.moves.length) {
        var white = Chess.moves[index];
        var black = Chess.moves[index + 1] || '';
        html = '<tr><td>' + (1 + index / 2) + '.</td><td>' +
            white + '</td><td>' + black + '</td></tr>' + html;
        index += 2;
    }
    $('#moves tbody').html(html);
};

Chess.saveMoves = function() {
    $.ajax({type: 'PUT',
            url: '/docs/' + Chess.anchor + '/moves',
            data: Chess.moves.join(' ')});
    var now = new Date();
    Chess.last_saved = now.getTime();
};

Chess.loadMoves = function() {
    $.ajax({type: 'GET',
            url: '/docs/' + Chess.anchor + '/moves',
            success: function(message, status, xhr) {
                // Ignore GET for 10 seconds after PUT.
                if (Chess.last_saved) {
                    var now = new Date();
                    var milliseconds = now.getTime() - Chess.last_saved;
                    if (milliseconds < 10000) { return; }
                }
                // Perform new moves from the server, or undo.
                Chess.updateMoves(message.split(' '));
            }});
};

Chess.identicalPrefix = function(array1, array2) {
    var stop = Math.min(array1.length, array2.length);
    for (var index = 0; index < stop; index++) {
        if (array1[index] !== array2[index]) { return false; }
    }
    return true;
};

Chess.parseMove = function(player, move) {
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
    var matches = move.match(/([KQBNRP]?)([a-h])([1-8])(x?)([a-h])([1-8])/);
    if (!matches) { return null; }
    return {
        kind: matches[1] || 'P',
        x1: Chess.fileX[matches[2]],
        y1: parseInt(matches[3], 10),
        captured: !!matches[4],
        x2: Chess.fileX[matches[5]],
        y2: parseInt(matches[6], 10)
    };
};

Chess.resurrectPiece = function(x, y) {
    // Create a piece that was captured here earlier.
    var tile_name = Chess.xFile[x] + y;
    var player, kind;
    if (y == 8) { player = 'black'; kind = Chess.xKind[x]; }
    if (y == 7) { player = 'black'; kind = 'pawn'; }
    if (y == 2) { player = 'white'; kind = 'pawn'; }
    if (y == 1) { player = 'white'; kind = Chess.xKind[x]; }
    for (var index = Chess.moves.length - 1; index >= 0; index--) {
        var move = Chess.moves[index];
        if (move.substr(-2) == tile_name) {
            player = Chess.moves.length % 2 ? 'white' : 'black';
            kind = Chess.letterKind[move[0]] || 'pawn';
            break;
        }
    }
    if (player && kind) {
        // console.log(x, y, move, player, kind);
        $('#board').append(Chess.makePiece(x, y, player, kind));
    } else {
        console.error("could not resurrect piece on %s", tile_name);
    }
};

Chess.castleMove = function(x1, y1, x2, y2) {
    if (x1 == 5 && x2 == 3) { return {x1: 1, y1: y1, x2: 4, y2: y2}; }
    if (x1 == 5 && x2 == 7) { return {x1: 8, y1: y1, x2: 6, y2: y2}; }
    if (x1 == 3 && x2 == 5) { return {x1: 4, y1: y1, x2: 1, y2: y2}; }
    if (x1 == 7 && x2 == 5) { return {x1: 6, y1: y1, x2: 8, y2: y2}; }
    console.error("Castling error: x1=" + x1 + " x2=" + x2);
    return false;
};

Chess.movePiece = function(piece, x1, y1, x2, y2, animate) {
    var css = {
        left: (x2 - 1) * Chess.tileSize + 'px',
        top: (8 - y2) * Chess.tileSize + 'px'};
    if (animate) {
        piece.animate(css);
    } else {
        piece.css(css);
    }
    piece.data('x', x2);
    piece.data('y', y2);
    Chess.pieces[x1][y1] = null;
    Chess.pieces[x2][y2] = piece;
    if (piece.data('kind') == 'king' && y1 == y2 && Math.abs(x2 - x1) == 2) {
        var r = Chess.castleMove(x1, y1, x2, y2);
        var rook = Chess.pieces[r.x1][r.y1];
        Chess.movePiece(rook, r.x1, r.y1, r.x2, r.y2, animate);
    }
};

Chess.redoMove = function(move, animate) {
    var player = Chess.moves.length % 2 ? 'black' : 'white';
    var m = Chess.parseMove(player, move);
    if (!m) { return false; }
    var piece = Chess.pieces[m.x1][m.y1];
    if (!piece) {
        console.error("move %s starts on an empty tile", move);
        return false;
    }
    var piece_kind = Chess.kindLetter[piece.data('kind')];
    if (m.kind != piece_kind) {
        console.error("move %s expected piece %s, found %s",
                      move, m.kind, piece_kind);
        return false;
    }
    var captured = Chess.pieces[m.x2][m.y2];
    if (m.captured && !captured) {
        console.warn("move %s expected capture, not found", move);
    }
    if (captured) {
        captured.remove(); // Remove captured piece from the board.
    }
    Chess.pushMove(piece, m.x1, m.y1, m.captured, m.x2, m.y2);
    Chess.movePiece(piece, m.x1, m.y1, m.x2, m.y2, animate);
    return true;
};

Chess.undoMove = function(animate) {
    if (!Chess.moves.length) { return false; }
    var move = Chess.moves.pop();
    var player = Chess.moves.length % 2 ? 'black' : 'white';
    var m = Chess.parseMove(player, move);
    if (!m) { return false; }
    var piece = Chess.pieces[m.x2][m.y2];
    if (!piece) {
        console.error("move %s piece not found", move);
        return false;
    }
    var piece_kind = Chess.kindLetter[piece.data('kind')];
    if (m.kind != piece_kind) {
        console.error("move %s expected piece %s, found %s",
                      move, m.kind, piece_kind);
        return false;
    }
    var origin = Chess.pieces[m.x1][m.y1];
    if (origin) {
        console.error("move %s origin not empty", move);
        return false;
    }
    Chess.movePiece(piece, m.x2, m.y2, m.x1, m.y1, animate);
    if (m.captured) {
        Chess.resurrectPiece(m.x2, m.y2); // Bring the captured piece back.
    }
    return true;
};

Chess.updateMoves = function(moves) {
    if (!Chess.identicalPrefix(moves, Chess.moves)) {
        Chess.resetBoard(); // Replay all moves from a fresh board.
    }
    var animate = Math.abs(moves.length - Chess.moves.length) == 1;
    for (var index = Chess.moves.length; index < moves.length; index++) {
        Chess.redoMove(moves[index], animate);
    }
    while (Chess.moves.length > moves.length) {
        Chess.undoMove(animate);
    }
    Chess.showMoves();
};

Chess.undo = function() {
    if (Chess.undoMove(true)) {
        Chess.saveMoves();
    }
    Chess.showMoves();
};

Chess.resetBoard = function() {
    $('.piece').remove();
    Chess.moves = [];
    Chess.makePieces();
};

Chess.makeBoard = function() {
    $("html").css({margin: 0, padding: 0});
    $("body").css({margin: 0, padding: 0});
    $(document).bind('mousemove touchmove', Chess.touchMove);
    $(document).bind('mouseup touchend touchcancel', Chess.touchEnd);
    var style = {width: 8 * Chess.tileSize + 'px',
                 height: 8 * Chess.tileSize + 'px',
                 position: 'relative',
                 'float': 'left'};
    var board = $("#board").css(style);
    for (var x = 1; x <= 8; x++) {
        Chess.tiles[x] = [null];
        Chess.pieces[x] = [null];
        for (var y = 1; y <= 8; y++) {
            var tile = $(document.createElement('div'));
            var shade = (x + y) % 2 ? 'light' : 'dark';
            tile.addClass(shade + ' tile');
            tile.data({x: x, y: y});
            tile.css({
                position: 'absolute',
                left: (x - 1) * Chess.tileSize + 'px',
                top: (8 - y) * Chess.tileSize + 'px',
                width: Chess.tileSize + 'px',
                height: Chess.tileSize + 'px'});
            board.append(tile);
            Chess.tiles[x][y] = tile;
            Chess.pieces[x][y] = null;
        }
    }
};

Chess.makePiece = function(x, y, player, kind) {
    var piece = $(document.createElement('div'));
    piece.addClass('piece ' + player + ' ' + kind);
    piece.data({x: x, y: y, player: player, kind: kind});
    piece.html(Chess.unicode[kind][player]);
    piece.css({position: 'absolute',
               left: (x - 1) * Chess.tileSize + 'px',
               top: (8 - y) * Chess.tileSize + 'px',
               width: Chess.tileSize + 'px',
               height: Chess.tileSize + 'px',
               cursor: 'move',
               'font-size': (2 * Chess.tileSize / 3) + 'px',
               'text-align': 'center'});
    piece.bind('mousedown touchstart', Chess.touchStart);
    Chess.pieces[x][y] = piece;
    return piece;
};

Chess.makePieces = function() {
    var board = $("#board");
    for (var x = 1; x <= 8; x++) {
        board.append(Chess.makePiece(x, 8, 'black', Chess.xKind[x]));
        board.append(Chess.makePiece(x, 7, 'black', 'pawn'));
        board.append(Chess.makePiece(x, 2, 'white', 'pawn'));
        board.append(Chess.makePiece(x, 1, 'white', Chess.xKind[x]));
    }
};

Chess.checkAnchor = function() {
    if (!document.location.hash.substr(1)) {
        // Add a random anchor to the URL if it doesn't have one.
        document.location.hash = '#' + Chess.randomUUID(5);
    }
    if (Chess.anchor != document.location.hash.substr(1)) {
        // Update the anchor if it has changed.
        Chess.anchor = document.location.hash.substr(1);
        Chess.loadMoves();
    }
};

Chess.DummyConsole = function() {
    if (!(this instanceof arguments.callee)) {
        throw new Error("Constructor was called without 'new' keyword.");
    }
    this.log = function() {};
    this.debug = function() {};
    this.info = function() {};
    this.warn = function() {};
    this.error = function() {};
};

Chess.documentReady = function() {
    if (typeof(window.console) == 'undefined') {
        window.console = new Chess.DummyConsole();
    }
    Chess.makeBoard();
    Chess.makePieces();
    Chess.checkAnchor();
    window.setInterval(Chess.checkAnchor, 200); // Five times per second.
    Chess.loadMoves();
    window.setInterval(Chess.loadMoves, 5000); // Every five seconds.
    $(window).mouseup(function() {
        window.getSelection().removeAllRanges();
    });
};

$(document).ready(Chess.documentReady);
