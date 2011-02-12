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

        var dlg;

        ts.addTest("Dialog fields", function(ut) {
            function testOnClick(evt, field) {
                ut.assert(field == dlg.getField('check'));
                ut.assert(dlg.hasChanged('check'));
                dlg.setValues({message: "Now click the Button"});
            }

            function testOnButton(evt, field) {
                ut.assert(field == dlg.getField('button'));
                ut.async(false);
            }

            dlg = new dialog.Dialog({
                fields: [
                    {name: 'message', type: 'message', value: "Check the box to pass the test."},
                    {name: 'default'},
                    {name: 'text', type: 'text'},
                    {name: 'check', type: 'checkbox', onClick: testOnClick},
                    {name: 'value', type: 'value'},
                    {name: 'password', type: 'password'},
                    {name: 'note', type: 'note'},
                    {name: 'button', type: 'button', onClick: testOnButton}
                ]
            });

            var div = document.createElement('div');
            div.innerHTML = dlg.html();
            var divDialog = div.firstChild;
            divStage.appendChild(div);

            var values = {
                'default': 'default string',
                text: 'text string',
                check: true,
                value: 'value string',
                password: 'secret',
                note: "this is a long\nnote"
            };

            dlg.setValues(values);
            dlg.setFocus();
            ut.assertEq(dlg.focus, 'default');
            var v2 = dlg.getValues();

            var rcDialog = dom.getRect(divDialog);
            redBox(rcDialog);
            for (var i = 0; i < dlg.fields.length; i++) {
                var field = dlg.fields[i];
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
                          "outside of dialog");
            }

            ts.coverage.cover('Dialog:enableField');
        }).require('document').async();

    }; // addTests

}); // org.startpad.dialog.test
