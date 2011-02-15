namespace.lookup('org.startpad.dialog.test').defineOnce(function (ns) {
    var util = namespace.util;
    var dialog = namespace.lookup('org.startpad.dialog');
    var dom = namespace.lookup('org.startpad.dom');
    var vector = namespace.lookup('org.startpad.vector');
    var loader = namespace.lookup('org.startpad.loader');

    var debugLayout = true;

    ns.addTests = function (ts) {

        // For layout debugging
        function redBox(rc) {
            if (!debugLayout) {
                return;
            }
            var box = document.createElement('div');
            box.style.backgroundColor = 'red';
            box.style.opacity = 0.1;
            box.style.position = 'absolute';
            box.style.zIndex = -1;
            dom.setRect(box, rc);
            document.body.appendChild(box);
        }

        var divStage = document.getElementById('stage');

        ts.addTest("style sheet", function(ut) {
            loader.loadStylesheet('../../css/dialog.css');

            // Don't know how to detect if stylesheet is loaded -
            // just give it 1 second.
            // REVIEW: use jQuery for loading stylesheet?
            function loaded() {
                ut.assert(true);
                ut.async(false);
            }
            setTimeout(loaded, 1000);
        }).async();

        ts.addTest("Dialog fields", function(ut) {
            var styles = ['div', 'table'];
            var dlgs = [];

            function testOnClick(evt, field, dlg) {
                ut.assert(field == dlg.getField('check'));
                ut.assert(!field.alreadyClicked, "check clicked twice");
                field.alreadyClicked = true;
                ut.assert(dlg.hasChanged('check'));
                dlg.setValues({message: "Now click the Button"});
            }

            function testOnButton(evt, field, dlg) {
                ut.assert(field == dlg.getField('button'));
                ut.assert(!field.alreadyClicked, "button clicked twice");
                field.alreadyClicked = true;
                dlg.setValues({message: "Thanks!"});
                if (dlg == dlgs[styles.length - 1]) {
                    console.log("async called");
                    ut.async(false);
                }
            }

            for (var j = 0; j < styles.length; j++) {
                dlgs[j] = new dialog.Dialog({
                    fields: [
                        {name: 'message', type: 'message',
                         value: "Check the box to pass the test."},
                        {name: 'default'},
                        {name: 'text', type: 'text'},
                        {name: 'check', type: 'checkbox', onClick: testOnClick},
                        {name: 'value', type: 'value'},
                        {name: 'password', type: 'password'},
                        {name: 'note', type: 'note'},
                        {name: 'button', type: 'button', onClick: testOnButton},
                        {name: 'other', type: 'button'}
                    ]
                });


                var div = document.createElement('div');
                div.style.width = "350px";
                dlgs[j].setStyle(dialog.styles[styles[j]]);
                div.innerHTML = dlgs[j].html();
                var divDialog = div.firstChild;
                divStage.appendChild(div);
                divStage.appendChild(document.createElement('hr'));

                var values = {
                    'default': 'default string',
                    text: 'text string',
                    check: true,
                    value: 'value string',
                    password: 'secret',
                    note: "this is a long\nnote"
                };

                dlgs[j].setValues(values);
                dlgs[j].setFocus();
                ut.assertEq(dlgs[j].focus, 'default');

                $('label', divDialog).each(function(i, elt) {
                    var content  = $(this).text();
                    ut.assertEq(content.indexOf('Button'), -1, "Button label");
                    ut.assertEq(content.indexOf('Message'), -1, "Message label");
                });

                var v2 = dlgs[j].getValues();

                var rcDialog = dom.getRect(divDialog);
                redBox(rcDialog);
                for (var i = 0; i < dlgs[j].fields.length; i++) {
                    var field = dlgs[j].fields[i];
                    var name = field.name;

                    ut.trace(name);

                    var elt = field.elt;
                    var rcField = dom.getRect(elt);

                    // Read same values out as we put in.
                    if (values[name] != undefined) {
                        ut.assertEq(values[name], v2[name]);
                    }

                    redBox(rcField);

                    ut.assert(vector.ptInRect(vector.ul(rcField), rcDialog) &&
                              vector.ptInRect(vector.lr(rcField), rcDialog),
                              "outside of dialog: [" + rcField + "] > [" + rcDialog + "]");
                }
            }

            ts.coverage.cover('Dialog:enableField');
        }).require('document').async(true, 30000);

    }; // addTests

}); // org.startpad.dialog.test
