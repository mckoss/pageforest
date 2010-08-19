namespace.lookup('com.pageforest.blocks').defineOnce(function (ns) {
    var clientLib = namespace.lookup('com.pageforest.client');
    var dom = namespace.lookup('org.startpad.dom');
    var vector = namespace.lookup('org.startpad.vector');
    var base = namespace.lookup('org.startpad.base');
    var util = namespace.util;

    function Board() {
        this.init(20, 50);
    }

    // Initialize the document - create a client helper object
    function onReady() {
        ns.brd = new Board();
        ns.client = new clientLib.Client(ns);
        ns.client.addAppBar();

        // App Bar can move elements on the screen
        ns.brd.resizeWindow();

        ns.client.poll();
    }

    Board.methods({
        constructor: Board,
        // The color of the edges of each of the cube faces (in order
        // of top, right, bottom, left.
        faceEdges: ["bbbb", "wwbb", "bwbb", "wbww", "bbww", "wwww"],

        // top, right, bottom, left (x,y) deltas
        dxdy: [[0, -1], [1, 0], [0, 1], [-1, 0]],

        init: function(rwMax, colMax) {
            this.rwMax = rwMax;
            this.colMax = colMax;
            this.buildUI();
            this.generateOrder();
        },

        resize: function() {
            var rows;
            var cols;

            try {
                rows = this.checkNum("rows", 1, 50);
                cols = this.checkNum("columns", 1, 50);
            } catch (e) {
                alert(e.message);
                return;
            }
            this.init(rows, cols);
        },

        checkNum: function(id, min, max) {
            var elt = document.getElementById(id);
            var num = parseInt(elt.value);
            if (isNaN(num) || num < min || num > max) {
                elt.focus();
                elt.select();
                throw new Error(id + " must be a number between " + min +
                                " and " + max + ".");
            }
            return num;
        },

        buildUI: function() {
            this.divBoard = document.getElementById("divBoard");
            if (this.tbl) {
                this.divBoard.removeChild(this.tbl);
            }
            this.tbl = document.createElement("table");
            this.cells = [];
            for (var rw = 0; rw < this.rwMax; rw++) {
                var tr = document.createElement("tr");
                this.cells[rw] = [];
                for (var col = 0; col < this.colMax; col++) {
                    var tdCell = document.createElement("td");
                    this.cells[rw][col] = document.createElement("div");
                    this.cells[rw][col].className = "face";
                    this.set(rw, col, 0, 0);
                    tdCell.appendChild(this.cells[rw][col]);
                    tr.appendChild(tdCell);
                }
                this.tbl.appendChild(tr);
            }

            this.divBoard.appendChild(this.tbl);
            this.tbl.onmousedown = this.click.fnMethod(this);
            window.onmouseup = this.mouseUp.fnMethod(this);
            this.tbl.onmousemove = this.mouseMove.fnMethod(this);

            var divTools = document.getElementById("divTools");
            if (!this.tdTools) {
                var tblTools = document.createElement("table");
                this.divTools = [];
                this.tdTools = [];
                var trTool = document.createElement("tr");
                trTool.className = "toolRow";
                for (var iFace = 0; iFace < 6; iFace++) {
                    var tdTool = document.createElement("td");
                    var divTool = document.createElement("div");

                    divTool.className = "faceTools";
                    divTool.style.backgroundPosition =
                        this.imagePositionTools(iFace, 0);
                    divTool.onmousedown =
                        this.clickTool.fnMethod(this).fnArgs(iFace);
                    divTool.iRot = 0;
                    tdTool.appendChild(divTool);
                    trTool.appendChild(tdTool);
                    this.divTools[iFace] = divTool;
                    this.tdTools[iFace] = tdTool;
                }
                tblTools.appendChild(trTool);

                trTool = document.createElement("tr");
                trTool.className = "rotRow";
                for (iFace = 0; iFace < 6; iFace++) {
                    var tdRot = document.createElement("td");
                    tdRot.onmousedown =
                        this.clickRot.fnMethod(this).fnArgs(iFace);
                    trTool.appendChild(tdRot);
                }
                tblTools.appendChild(trTool);
                divTools.appendChild(tblTools);
                this.clickTool(null, 5);
            }

            window.onresize = this.resizeWindow.fnMethod(this);
            this.resizeWindow();
        },

        resizeWindow: function(evt) {
            this.divBoard.style.width = this.tbl.offsetWidth + "px";
            this.ptTable = dom.getPos(this.tbl);
        },

        click: function(evt) {
            var pt = this.rwColFromEvt(evt);
            this.set(pt[1], pt[0], this.iTool, this.iRot);
            this.ptLast = pt;
            return false;
        },

        mouseMove: function(evt) {
            if (this.ptLast == undefined) {
                return;
            }
            var pt = this.rwColFromEvt(evt);
            if (vector.equal(pt, this.ptLast)) {
                return;
            }
            this.click(evt);
        },

        mouseUp: function(evt) {
            this.ptLast = undefined;
        },

        rwColFromEvt: function(evt) {
            var pt = vector.sub([evt.pageX, evt.pageY], this.ptTable);
            return vector.floor(vector.mult(pt, 1 / 21));
        },

        set: function(rw, col, iFace, iRot) {
            if (rw < 0 || rw >= this.rwMax || col < 0 || col >= this.colMax) {
                return;
            }
            var cell = this.get(rw, col);
            cell.iFace = iFace;
            cell.iRot = iRot;
            cell.style.backgroundPosition =
                this.imagePosition(iFace,
                                   iFace == 5 ? base.randomInt(4) : iRot);
        },

        // Return the div for the cell at position (col, rw)
        get: function(rw, col) {
            if (rw < 0 || rw >= this.rwMax ||
                col < 0 || col >= this.colMax) {
                return undefined;
            }

            return this.cells[rw][col];
        },

        clickTool: function(evt, iFace) {
            if (iFace == this.iTool) {
                return;
            }

            if (this.iTool != undefined) {
                this.tdTools[this.iTool].className = "";
            }
            this.tdTools[iFace].className = "selected";
            this.iTool = iFace;
            this.iRot = this.divTools[iFace].iRot;
        },

        clickRot: function(evt, iFace) {
            this.clickTool(evt, iFace);
            var divTool = this.divTools[iFace];
            divTool.iRot = (divTool.iRot + 1) % 4;
            this.iRot = divTool.iRot;
            divTool.style.backgroundPosition =
                this.imagePositionTools(iFace, divTool.iRot);
        },

        fill: function() {
            for (var i = 0; i < this.order.length; i++) {
                this.set(this.order[i][0],
                         this.order[i][1],
                         this.iTool,
                         this.iRot);
            }
        },

        randomize: function() {
            for (var rw = 0; rw < this.rwMax; rw++) {
                for (var col = 0; col < this.colMax; col++) {
                    this.set(rw, col, base.randomInt(6), base.randomInt(4));
                }
            }
        },

        invert: function() {
            for (var rw = 0; rw < this.rwMax; rw++) {
                for (var col = 0; col < this.colMax; col++) {
                    var cell = this.get(rw, col);
                    this.set(rw, col, 5 - cell.iFace, cell.iRot);
                }
            }
        },

        generateOrder: function() {
            this.order = [];
            for (var rw = 0; rw < this.rwMax; rw++) {
                for (var col = 0; col < this.colMax; col++) {
                    this.order.push([rw, col]);
                }
            }

            this.shuffle(this.order);
        },

        shuffle: function(order) {
            for (var i = 0; i < order.length; i++) {
                var j = base.randomInt(order.length - i);
                var temp = order[i];
                order[i] = order[j];
                order[j] = temp;
            }
        },

        smooth: function() {
            this.generateOrder();

            for (var i = 0; i < this.order.length; i++) {
                var rw = this.order[i][0];
                var col = this.order[i][1];
                var cell = this.get(rw, col);

                var cellT = this.checkNeighbors(rw, col);

                this.set(rw, col, cellT[0], cellT[1]);
            }
        },

        // Return the [iFace, iRot] that would best match the
        // surrounding neighbors.  This function should be
        // "stable" in that we don't modify the cell if there
        // is no compelling reason to change it.
        checkNeighbors: function(rw, col) {
            var cell = this.get(rw, col);
            var edges = this.neighborEdge(rw, col);

            // Loop over 4 rotations of each edge pattern.
            for (var j = 0; j < 4; j++) {
                // Saddle point - all black or all white
                if (/bwbw/.test(edges)) {
                    if (cell.iFace < 3) {
                        return [0, 0];
                    }
                    return [5, 0];
                }

                // Corner - inside or outside curve depending
                // on amount of black in cell.
                if (/bbww/.test(edges)) {
                    if (cell.iFace < 3) {
                        return [1, (2 + j) % 4];
                    }
                    return [4, j];
                }

                // Rotate edge pattern
                edges = edges.slice(1) + edges.charAt(0);
            }

            return [cell.iFace, cell.iRot];
        },

        // Return a 4 character string of 'b' and 'w' depending on the
        // edge-color of the top, right, bottom, left cells
        neighborEdge: function(rw, col) {
            var edges = "";

            for (var i = 0; i < 4; i++) {
                var rwT = rw + this.dxdy[i][1];
                var colT = col + this.dxdy[i][0];
                var cellT = this.get(rwT, colT);
                if (rwT == -1 || rwT == this.rwMax ||
                   colT == -1 || colT == this.colMax) {
                    edges += "b";
                } else {
                    edges += this.faceEdges[cellT.iFace].
                        charAt((6 + i - cellT.iRot) % 4);
                }
            }

            //console.log(edges);
            return edges;
        },

        // Return Image Array postioning of tile give face index and
        // rotation (0-3)
        imagePositionTools: function(iFace, iRot) {
            return (-iRot * 100) + "px " + (-iFace * 100) + "px";
        },

        imagePosition: function(iFace, iRot) {
            return (-iRot * 20) + "px " + (-iFace * 20) + "px";
        },

        getCells: function() {
            var cells = [];
            for (var rw = 0; rw < this.rwMax; rw++)
            {
                cells[rw] = [];
                for (var col = 0; col < this.colMax; col++)
                {
                    var cell = this.get(rw, col);
                    cells[rw][col] = [cell.iFace, cell.iRot];
                }
            }
            return cells;
        },

        setCells: function(cells) {
            for (var rw = 0; rw < cells.length; rw++) {
                var row = cells[rw];
                for (var col = 0; col < row.length; col++) {
                    this.set(rw, col,
                             cells[rw][col][0],
                             cells[rw][col][1]);
                }
            }
            return this;
        }
    });


    // This function is called whenever your document should be reloaded.
    function setDoc(json) {
        var blob = json.blob;
        this.brd.init(blob.rows, blob.cols);
        this.brd.setCells(blob.cells);
    }

    // Convert your current state to JSON with title and blob properties,
    // these will then be saved to pageforest's storage.
    function getDoc() {
        return {
            "blob": {
                rows: ns.brd.rwMax,
                cols: ns.brd.colMax,
                cells: ns.brd.getCells()
            },
            "readers": ["public"]
        };
    }

    // Exported functions
    ns.extend({
        'onReady': onReady,
        'getDoc': getDoc,
        'setDoc': setDoc
    });

});
