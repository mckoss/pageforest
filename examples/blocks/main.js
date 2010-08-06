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
        ns.client.setLogging(true);
        // Quick call to poll - don't wait a whole second to try loading
        // the doc and logging in the user.
        ns.client.poll();
    }

    Board.methods({
        constructor: Board,
        faceEdges: ["bbbb", "wwbb", "bwbb", "wbww", "bbww", "wwww"],
        rules: [[/bbbb/, [0, 0]],
                [/bbbw/, [2, 2]],
                [/bwbw/, [6, 0]],
                [/bbww/, [7, 0]],
                [/wwwb/, [3, 2]],
                [/wwww/, [5, 0]]],
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
            this.__divBoard = document.getElementById("divBoard");
            if (this.__tbl) {
                this.__divBoard.removeChild(this.__tbl);
            }
            this.__tbl = document.createElement("table");
            this.__cells = [];
            for (var rw = 0; rw < this.rwMax; rw++) {
                var tr = document.createElement("tr");
                this.__cells[rw] = [];
                for (var col = 0; col < this.colMax; col++) {
                    var tdCell = document.createElement("td");
                    this.__cells[rw][col] = document.createElement("div");
                    this.__cells[rw][col].className = "face";
                    this.set(rw, col, 0, 0);
                    tdCell.appendChild(this.__cells[rw][col]);
                    tr.appendChild(tdCell);
                }
                this.__tbl.appendChild(tr);
            }

            this.__divBoard.appendChild(this.__tbl);
            this.__tbl.onmousedown = this.click.fnMethod(this);
            window.onmouseup = this.mouseUp.fnMethod(this);
            this.__tbl.onmousemove = this.mouseMove.fnMethod(this);

            var divTools = document.getElementById("divTools");
            if (!this.__tdTools) {
                var tblTools = document.createElement("table");
                this.__divTools = [];
                this.__tdTools = [];
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
                    this.__divTools[iFace] = divTool;
                    this.__tdTools[iFace] = tdTool;
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
            this.__divBoard.style.width = this.__tbl.offsetWidth + "px";
            this.__ptTable = dom.ptClient(this.__tbl);
        },

        click: function(evt) {
            var pt = this.rwColFromEvt(evt);
            this.set(pt[1], pt[0], this.__iTool, this.__iRot);
            this.__ptLast = pt;
            return false;
        },

        mouseMove: function(evt) {
            if (this.__ptLast == undefined) {
                return;
            }
            var pt = this.rwColFromEvt(evt);
            if (vector.equal(pt, this.__ptLast)) {
                return;
            }
            this.click(evt);
        },

        mouseUp: function(evt) {
            this.__ptLast = undefined;
        },

        rwColFromEvt: function(evt) {
            var pt = vector.sub([evt.pageX, evt.pageY], this.__ptTable);
            return vector.floor(vector.mult(pt, 1 / 21));
        },

        set: function(rw, col, iFace, iRot) {
            if (rw < 0 || rw >= this.rwMax || col < 0 || col >= this.colMax) {
                return;
            }
            var cell = this.__cells[rw][col];
            cell.iFace = iFace;
            cell.iRot = iRot;
            cell.style.backgroundPosition =
                this.imagePosition(iFace,
                                   iFace == 5 ? base.randomInt(4) : iRot);
        },

        Get: function(rw, col) {
            return this.__cells[rw][col];
        },

        clickTool: function(evt, iFace) {
            if (iFace == this.__iTool) {
                return;
            }

            if (this.__iTool != undefined) {
                this.__tdTools[this.__iTool].className = "";
            }
            this.__tdTools[iFace].className = "selected";
            this.__iTool = iFace;
            this.__iRot = this.__divTools[iFace].iRot;
        },

        clickRot: function(evt, iFace) {
            this.clickTool(evt, iFace);
            var divTool = this.__divTools[iFace];
            divTool.iRot = (divTool.iRot + 1) % 4;
            this.__iRot = divTool.iRot;
            divTool.style.backgroundPosition =
                this.imagePositionTools(iFace, divTool.iRot);
        },

        fill: function() {
            for (var i = 0; i < this.__order.length; i++) {
                this.set(this.__order[i][0],
                         this.__order[i][1],
                         this.__iTool,
                         this.__iRot);
            }
        },

        randomize: function() {
            for (var rw = 0; rw < this.rwMax; rw++) {
                for (var col = 0; col < this.colMax; col++) {
                    this.set(rw, col, base.randomInt(6), base.randomInt(4));
                }
            }
        },

        generateOrder: function() {
            this.__order = [];
            for (var rw = 0; rw < this.rwMax; rw++) {
                for (var col = 0; col < this.colMax; col++) {
                    this.__order.push([rw, col]);
                }
            }

            this.shuffle(this.__order);
        },

        shuffle: function(order) {
            for (var i = 0; i < order.length; i++) {
                var j = base.randomInt(order.length - i);
                var temp = order[i];
                order[i] = order[j];
                order[j] = temp;
            }
        },

        change: function() {
            for (var i = 0; i < this.__order.length; i++) {
                var rw = this.__order[i][0];
                var col = this.__order[i][1];
                var temp;

                if (Math.random() < 0.1 &&
                    this.__cells[rw][col].iFace == 2) {
                    temp = this.dxdy[this.__cells[rw][col].iRot];
                    this.set(rw - temp[0],
                             col + temp[1],
                             2,
                             this.__cells[rw][col].iRot);
                    this.set(rw, col,  5, 0);
                }
                if (Math.random() < 0.1 && this.__cells[rw][col].iFace == 3) {
                    temp = this.dxdy[this.__cells[rw][col].iRot];
                    this.set(rw - temp[0],
                             col + temp[1],
                             3,
                             this.__cells[rw][col].iRot);
                    this.set(rw, col, 0, 0);
                }
            }
            this.smooth();
        },

        smooth: function() {
            this.generateOrder();

            for (var i = 0; i < this.__order.length; i++) {
                var rw = this.__order[i][0];
                var col = this.__order[i][1];

                var edge = this.checkNeighbors(rw, col);

                if (edge[0] == 6) {
                    if (this.__cells[rw][col].iFace < 3) {
                        edge[0] = 0;
                    }
                } else {
                    edge[0] = 5;
                }

                if (edge[0] == 7) {
                    if (this.__cells[rw][col].iFace >= 3) {
                        edge[0] = 4;
                    }
                } else {
                    edge[0] = 1;
                    edge[1] = (edge[1] + 2) % 4;
                }

                this.set(rw, col, edge[0], edge[1]);
            }
        },

        checkNeighbors: function(rw, col) {
            var cell = this.Get(rw, col);
            var edges = this.neighborEdge(rw, col);

            for (var i = 0; i < this.rules.length; i++) {
                for (var j = 0; j < 4; j++) {
                    if (this.rules[i][0].test(edges)) {
                        return [this.rules[i][1][0],
                                ((4 + j - this.rules[i][1][1]) % 4)];
                    }
                    var firstChar = edges.charAt(0);
                    edges = edges.slice(1) + firstChar;
                }
            }
            console.log("failed! rw: " + rw +
                        " col: " + col + " edges:" + edges);

            return [5, 0];
        },

        neighborEdge: function(rw, col) {
            var edges = "";

            for (var i = 0; i < 4; i++) {
                var rwT = rw + this.dxdy[i][1];
                var colT = col + this.dxdy[i][0];
                if (rwT == -1 || rwT == this.rwMax ||
                   colT == -1 || colT == this.colMax) {
                    edges += "b";
                } else {
                    edges += this.faceEdges[(this.__cells[rwT][colT].iFace)].
                        charAt((6 + i - this.__cells[rwT][colT].iRot) % 4);
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
                    var cell = this.__cells[rw][col];
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
            "title": "1,000 Blocks",
            "blob": {
                rows: ns.brd.rwMax,
                cols: ns.brd.colMax,
                cells: ns.brd.getCells()
            },
            "readers": ["public"]
        };
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
        // Allow save if doc is dirty OR not bound (yet) to a document.
        if (ns.client.isSaved()) {
            $('#save').attr('disabled', 'disabled');
        }
        else {
            $('#save').removeAttr('disabled');
        }
    }

    // Exported functions
    ns.extend({
        'onReady': onReady,
        'getDoc': getDoc,
        'setDoc': setDoc,
        'onStateChange': onStateChange,
        'signInOut': signInOut,
        'onUserChange': onUserChange
    });

});
