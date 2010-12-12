// Pageforest.js

// TODO: Protect against multiple inclusions of this file - conditional loading.

PF.Extend(PF, {
optionsDefault: {color: "green"},       // Default options - used if none supplied by application
tokens: {                                                       // String constants
        idWidget: "PF_Widget",
        classTopbar: "PF_topbar",
        idHistWidget: "PF_SaveHistory",
        stWidget: '<div class="PF_savebar"><div class="PF_left"></div><div class="PF_center">'+
                '<div class="logo"></div>' +
                '<a href="#" onclick="PF.Save();">Save</a>&nbsp;' +
                '<a href="#" onclick="PF.SignIn();">Sign In</a>&nbsp;' +
                '<a href="#" onclick="PF.Help();">Help?</a>&nbsp;' +
                '</div><div class="PF_right"></div></div>'
},
stMsg: {                                                        // Error messages
        errInstall: "Widget installation error: ",
        errCon: "Incorrectly defined application constructor.",
        errAppName: "Application constructor must be globally named.",
        errNotImp: "Missing implementation for function: ",
        errSigned: "Developer user name missing.",
        errAnonFunc: "Anonymous function can not be reloaded properly - use PF.NameFunctions",
        errDeriveSelf: "Error - cannot derive from self"
        },
apps: [],

Register: function(app, optRegister)
        {
        // Add to list of installed applications
        this.apps.push(app);

        var options = {};
        PF.Extend(options, PF.optionsDefault, PF.options, optRegister);
        PF.options = options;
        console.log("PF.options=", PF.options);
        // TODO: Maybe I should relax this test and use ExtendIfMissing instead.
        if (app.constructor == Object || typeof app.constructor != "function")
                throw(new Error(PF.stMsg.errCon));
        if (PF.FunctionName(app.constructor) == "PF.AnonFunction")
                throw(new Error(PF.stMsg.errAppName));
        app.constructor.DeriveFrom(PF.App);
        app.__ds = new PF.DocState(app, options);

        console.log("Application Registered");

        this.InstallWidget(app);
        },

// TODO: Rename "widget" to "AppBar" throughout
InstallWidget: function(app)
        {
        if (this.fWidgetInstalled)
                return;
        this.fWidgetInstalled = true;

        var divWidget = document.createElement("div");
        divWidget.id = PF.tokens.idWidget;
        divWidget.className = PF.tokens.classTopbar;
        document.body.appendChild(divWidget);

        divWidget.innerHTML = PF.tokens.stWidget;
        },

Save: function()
        {
        // TODO: Enable multi-application save
        PF.apps[0].Save();
        },

Reload: function()
        {
        // TODO: multi-application load
        PF.apps[0].__ds.InitLoad();
        },

// Dfaut id loader: #user_id or #user_slug
// URL options:
// #user_id: default (multiple documents per user)
// #user: for single instance per user applications
// #slug: for application global (Wiki case)
GetURLInfo: function()
        {
    if (window.location.hash == "")
                return null;

        var rgDID = window.location.hash.match(/[#](.*)_(.*)/);
        if (!rgDID)
                return null;

        return {user:rgDID[1], did: rgDID[2]};
        },

SetLoadId: function(info)
        {
        window.location.hash = info.user + "_" + info.did;
        },

ReportError: function(st)
        {
        // BUG: Incorporate into PF UI
        alert("Error: " + st);
        },

StatusMessage: function(st)
        {
        // TODO: Proper UI for status messages
        alert("Pageforest: " + st);
        }
}); // PF.Extend()

// Default implementations of App required methods

// Constructor never called - since we in-place Derive the user's app object during Register.
PF.App = function() {};

PF.App.prototype = {
constructor: PF.App,
// Methods typically overridden:
// GetTitle, GetDescription, GetSaveObject, LoadFromObject
GetTitle: function()
        {
        return document.title;
        },

GetDescription: function()
        {
        // Get Meta Description if any.
        },

// Load Sequence:
// app.GetURLInfo() -> {user, did}
// Cmd:Get -> obj
// app.LoadFromObject(obj) -> app
// app.PostLoad()
LoadFromObject: function (obj)
        {
        return obj;
        },

// Called after application has been loaded
PostLoad: function()
        {
        },

// Returns {user:, did:}
GetURLInfo: function()
        {
        return PF.GetURLInfo();
        },

// Save Sequence:
// (initiated by Save Widget, or call to app.Save())
// app.PreSave()
// app.GetSaveObject() -> obj
// Cmd:Save(obj)
// app.PostSave(info) - save version etc.
Save: function()
        {
        this.__ds.Save();
        },

// Called just before saving the state of the application
PreSave: function()
        {
        },

// Return the object which is to be saved
GetSaveObject: function ()
        {
        return this;
        },

// Called after save is complete
PostSave: function(info)
        {
        PF.SetLoadId(info);
        }
}; // PF.App

// PageForest dialog
// Useage:
// var db = new PF.DialogBox();
// db.Init({title:,fields:,fieldsBottom:,buttons:}, fnCallback);
// db.Show(true);
// -> fnCallback(options) (fields have .value properties added)

PF.DialogBox = function()
{
        var stHTML =
        '<div class="pf-pos"><div class="pf-box top"></div><div class="pf-box middle"></div><div class="pf-box bottom">'+
        '<div></div><div class="pf-buttons"></div><div class="pf-stem"></div></div></div>';

        // Background for lightbox transparency
        this.divScreen = document.createElement("div");
        this.divScreen.className = "pf-screen";
        document.body.appendChild(this.divScreen);

        // Containing div for clipping to window
        this.divClip = document.createElement("div");
        this.divClip.className = "pf-clip";
        this.divClip.innerHTML = stHTML;

        this.divPos = this.divClip.childNodes[0];
        this.divTop = this.divPos.childNodes[0];
        this.divMiddle = this.divPos.childNodes[1];
        this.divBottom = this.divPos.childNodes[2].childNodes[0];
        this.divButtons = this.divPos.childNodes[2].childNodes[1];
        this.divStem = this.divPos.childNodes[2].childNodes[2];

        document.body.appendChild(this.divClip);

        this.fShow = false;
        // Relative to top of box
        this.rcClose = [302, 11, 310, 19];
};

PF.DialogBox.prototype = {
        constructor: PF.DialogBox,
        tokens: {
                required: " is required.",
                idPre: "PF_DB"
                },
        errors: [],
        optionsDefault: {
                title: "Save Page / Create Account",
                focus: "user",
                enter: "save",
                message: "message",
                fields: {
                        message:{hidden: true, value:"Your message here", type: 'message'},
                        user:{label: "Username", type: 'text', required:true},
                        pass:{label: "Password", type: 'password', required:true},
                        email:{label: "Email", type: 'text'},
                        comments:{label: "Page Comments", type: 'note'}
                        },
                fieldsBottom: {
                        captcha:{type: "captcha", required:true, labelShort:"Proof of Humanity"},
                        tos:{label: 'I agree to the <a tabindex="-1" href="/terms-of-service">Terms of Service</a>',
                                type: "checkbox", required:true, labelShort:"Terms of Service"}
                        },
                buttons: {
                        save:{label: "Save", type: 'button'}
                        }
                },
        htmlPatterns: {
                title: '<h1>{title}</h1>',
                text: '<label>{label}:</label><input id="PF_DB{n}" type="text" value="{value}"/>',
                password: '<label>{label}:</label><input id="PF_DB{n}" type="password"/>',
                checkbox: '<label class="checkbox" for="PF_cb{n}"><input id="PF_DB{n}" type="checkbox"/>{label}</label>',
                note: '<label>{label}:</label><textarea id="PF_DB{n}" rows="5">{value}</textarea>',
                captcha: '<label>What does {q} =<input id="PF_DB{n}" type="text"/></label>',
                message: '<span id="PF_DB{n}">{value}</span>',
                button: '<input type="button" value="{label}" onclick="PF.DialogBox.ButtonClick(\'{name}\');"/>'
                },

Init: function (options)
        {
        if (this.fShow)
                throw Error("Cannot re-initialize dialog box while modal dialog dispayed.");

        this.options = {};
        PF.ExtendCopy(this.options, this.optionsDefault, options);
        this.ifld = 0;

        this.InitDiv(this.divTop, [{type: 'title', title:this.options.title}]);
        this.InitDiv(this.divMiddle, this.options.fields);
        this.InitDiv(this.divBottom, this.options.fieldsBottom);
        this.InitDiv(this.divButtons, this.options.buttons);
        console.log(this.divClip.innerHTML);

        this.InitFields(this.options.fields);
        this.InitFields(this.options.fieldsBottom);

        this.ResizeBox(true);
        },

// Size the Middle section to fit the elements within it
ResizeBox: function(fHidden)
        {
        if (fHidden)
                {
                this.divClip.style.visibility = "hidden";
                this.divClip.style.display = "block";
                }
        var elt = this.divMiddle.lastChild;
        var ptMid = PF.DOM.PtClient(this.divMiddle);
        var ptElt = PF.DOM.PtClient(elt);
        this.dyMiddle = ptElt[1] - ptMid[1] + elt.offsetHeight + 4;
        this.divMiddle.style.height = this.dyMiddle + "px";
        if (fHidden)
                {
                this.divClip.style.display = "none";
                this.divClip.style.visibility = "visible";
                }
        },

// Additional field initialization after builing HTML for the form
InitFields: function(fields)
        {
        for (var prop in fields)
                {
                var fld = this.GetField(prop);

                // Hide any "hidden" fields
                if (fld.hidden)
                        fld.elt.style.display = "none";
                }
        },

InitDiv: function(div, fields, fResize)
        {
        var stb = new PF.StBuf();
        for (var prop in fields)
                {
                var fld = fields[prop];
                fld.n = this.ifld++;
                var keys = {q:"2+2", name:prop};
                PF.Extend(keys, fld);
                stb.Append(PF.ReplaceKeys(this.htmlPatterns[fld.type], keys));
                }
        div.innerHTML = stb.toString();
        },

FieldError: function(fld, stError)
        {
        this.errors.push({fld:fld, error:stError});
        },

ExtractValues: function(fields)
        {
        for (var prop in fields)
                {
                var fld = this.GetField(prop);
                if (!fld.elt)
                        continue;

                switch (fld.elt.tagName.toLowerCase())
                        {
                case "input":
                        if (fld.elt.type == "checkbox")
                                {
                                fld.value = fld.elt.checked;
                                if (fld.required && !fld.value)
                                        this.FieldError(fld, (fld.labelShort || fld.label) + this.tokens.required);
                                }
                        else
                                {
                                fld.value = fld.elt.value.Trim();
                                if (fld.required && fld.value.length == 0)
                                        this.FieldError(fld, (fld.labelShort || fld.label) + this.tokens.required);
                                }
                        break;
                case "textarea":
                        fld.value = fld.elt.value.Trim();
                        break;
                        }
                }
        },

Show: function(fShow, fnCallback)
        {
        if (this.fShow == fShow)
                return;
        this.fShow = fShow;

        var rcWindow = PF.DOM.RcWindow();

        if (fShow)
                {
                this.fnCallback = fnCallback;

                // Need to display box in order to get measurements
                // TODO: move offscreen to the left first?
                //PF.DOM.SetRc(this.divClip, rcWindow);

                // Position it in the center/top third of the window
                var rcBox = [0, 0, 328, 38 + this.dyMiddle + 141];
                var scale = [0.5, 0.33];
                var ptWindow = PF.Vector.PtCenter(rcWindow, scale);
                this.ptPos = PF.Vector.PtCenter(rcBox, scale);
                this.ptPos = PF.Vector.Max([0, 0], PF.Vector.Sub(ptWindow, this.ptPos));

                // Show off screen and then slide to final position
                this.SlideIn(rcWindow[2]);
                this.divScreen.style.display = this.divClip.style.display = "block";
                this.slew = new PF.Slew({start: rcWindow[2], end: this.ptPos[0], vMax: 800});
                this.slew.Start(this.SlideIn.FnMethod(this));

                // Dialog is modal - capture all events
                this.ifn = [];
                this.ifn.push(PF.AddEventFn(window, "mousedown", this.MouseDown.FnMethod(this)));
                this.ifn.push(PF.AddEventFn(window, "mouseup", this.MouseUp.FnMethod(this)));
                this.ifn.push(PF.AddEventFn(window, "mousemove", this.MouseMove.FnMethod(this)));
                this.ifn.push(PF.AddEventFn(window, "resize", this.ResizeWindow.FnMethod(this)));
                this.ifn.push(PF.AddEventFn(window, "keydown", this.KeyDown.FnMethod(this)));
                this.ifn.push(PF.AddEventFn(window, "focus", this.Focus.FnMethod(this), true));

                // Set global variable for receiving button click (assumes one dialog is active)
                PF.DialogBox.ButtonClick = this.ButtonClick.FnMethod(this);
                }
        else
                {
                for (var i = 0; i < this.ifn.length; i++)
                        PF.RemoveEventFn(this.ifn[i]);

                this.CancelMove();
                PF.DialogBox.ButtonClick = undefined;
                this.slew = new PF.Slew({start: this.ptBoxLast[0], end: rcWindow[2], vMax: 800});
                this.slew.Start(this.SlideOut.FnMethod(this));
                }
        },

ButtonClick: function(stButton)
        {
        this.errors = [];
        this.ExtractValues(this.options.fields);
        this.ExtractValues(this.options.fieldsBottom);

        if (this.errors.length > 0)
                {
                if (this.options.message)
                        {
                        var fld = this.GetField(this.options.message);
                        fld.elt.firstChild.nodeValue = this.errors[0].error;
                        fld.elt.style.display = "block";
                        }
                else
                        alert(this.errors[0].error);
                this.errors[0].fld.elt.focus();
                this.errors[0].fld.elt.select();
                this.ResizeBox();
                return;
                }

        if (this.fnCallback)
                {
                var fields = {button:stButton};
                PF.Extend(fields, this.options.fields, this.options.fieldsBottom);
                this.fnCallback(fields);
                }
        this.Show(false);
        },

GetField: function(stName)
        {
        var fld = this.options.fields[stName];
        if (!fld)
                fld = this.options.fieldsBottom[stName];
        if (fld)
                fld.elt = document.getElementById(this.tokens.idPre + fld.n);
        return fld;
        },

SlideIn: function(x, fFinal)
        {
        this.SetPosition([x, this.ptPos[1]]);
        if (fFinal && this.options.focus)
                {
                var fld = this.GetField(this.options.focus);
                if (fld)
                        {
                        fld.elt.focus();
                        fld.elt.select();
                        }
                }
        },

SlideOut: function(x, fFinal)
        {
        this.SetPosition([x, this.ptBoxLast[1]]);
        if (fFinal)
                this.divScreen.style.display = this.divClip.style.display = "none";
        },

MouseDown: function(evt)
        {
        var ptMouse = PF.DOM.PtMouse(evt);

        // Click in the title bar - to start dragging
        if (PF.Vector.PtInRect(ptMouse, this.rcTitle))
                {
                this.ptMouseDown = ptMouse;
                this.ptInitDrag = PF.Vector.UL(this.rcTitle);
                var ptRel = PF.Vector.Sub(this.ptMouseDown, this.rcTitle);

                // Handle close box
                if (PF.Vector.PtInRect(ptRel, this.rcClose))
                        this.Show(false);
                evt.preventDefault();
                return false;
                }

        // Allow clicks inside the dialog - but not static text selection
        if (PF.Vector.PtInRect(ptMouse, this.rcDialog))
                {
                switch (evt.target.tagName.toLowerCase())
                        {
                // BUG: Can STILL drag from checkbox label to select text!
                case "label":
                        if (evt.target.className.toLowerCase() != "checkbox")
                                 break;
                case "input":
                case "textarea":
                        return true;
                        }
                evt.preventDefault();
                return false;
                }

        // Dialog is modal - don't process click outside of it
        evt.preventDefault();
        return false;
        },

MouseUp: function(evt)
        {
        this.CancelMove();
        },

Focus: function(evt)
        {
        this.hasFocus = evt.target;
        },

KeyDown: function(evt)
        {
        if (evt.keyCode == 27)
                {
                this.Show(false);
                evt.preventDefault();
                }

        // Hit the OK button on Enter - unless we have a textarea selected
        if (evt.keyCode == 13 && this.options.enter &&
                this.hasFocus && this.hasFocus.tagName.toLowerCase() != "textarea")
                {
                this.ButtonClick(this.options.enter);
                evt.preventDefault();
                }

        },

MouseMove: function(evt)
        {
        var ptMouse = PF.DOM.PtMouse(evt);
        if (this.ptMouseDown)
                {
                var ptDiff = PF.Vector.Sub(ptMouse, this.ptMouseDown);
                PF.Vector.AddTo(ptDiff, this.ptInitDrag);
                this.SetPosition(ptDiff);
                return;
                }

        var ptRel = PF.Vector.Sub(ptMouse, this.rcTitle);
        if (PF.Vector.PtInRect(ptRel, this.rcClose))
                this.divTop.style.cursor = "pointer";
        else
                this.divTop.style.cursor = "move";
        evt.preventDefault();
        },

CancelMove: function()
        {
        this.ptMouseDown = undefined;
        },

SetPosition: function(ptBox)
        {
        this.ptBoxLast = ptBox;

        PF.DOM.SetAbsPosition(this.divPos, ptBox);

        // Note: Due to FF bug - we don't make top div overflow:hidden and shrink it
        // as a consequence, the window can scroll when the the dialog moves from
        // offscreen to onscreen.

        // Size the stem to the RHS of the window
        var rcWindow = PF.DOM.RcWindow();
        // Stem will be a bit bigger than needed - but clipped to outer box anyway
        this.divStem.style.width = (rcWindow[2] - ptBox[0] - 328) + 'px';

        // Absolute document client coordinates
        this.rcTitle = PF.DOM.RcClient(this.divTop);
        this.rcDialog = PF.Vector.BoundingBox(PF.DOM.RcClient(this.divMiddle),
                PF.DOM.RcClient(this.divButtons));
        },

ResizeWindow: function()
        {
        if (this.fShow)
                this.SetPosition(this.ptBoxLast);
        }
};
