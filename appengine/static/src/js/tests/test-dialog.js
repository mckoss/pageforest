namespace.lookup('org.startpad.dialog.test').defineOnce(function (ns) {
    var util = namespace.util;
    var dialog = namespace.lookup('org.startpad.dialog');
    var dom = namespace.lookup('org.startpad.dom');
    var vector = namespace.lookup('org.startpad.vector');
    var loader = namespace.lookup('org.startpad.loader');

    ns.addTests = function (ts) {
        function redBox(rc) {
            if (true) {
                return;
            }
            var box = document.createElement('div');
            box.style.backgroundColor = 'red';
            box.style.border = '1px solid green';
            box.style.opacity = 0.5;
            box.style.position = 'absolute';
            dom.setRect(box, rc);
            document.body.appendChild(box);
        }

        var divStage = document.getElementById('stage');

        ts.addTest("style sheet", function(ut) {
            loader.loadStylesheet('../../css/dialog.css');

            // Don't know how to detect if stylesheet is loaded -
            // just give it 1 second.
            function loaded() {
                ut.assert(true);
                ut.async(false);
            }
            setTimeout(loaded, 1000);
        }).async();

        ts.addTest("Dialog fields", function(ut) {
            var dlg = new dialog.Dialog({
                fields: [
                    {name: 'default'},
                    {name: 'text', type: 'text'},
                    {name: 'check', type: 'checkbox'},
                    {name: 'value', type: 'value'},
                    {name: 'password', type: 'password'},
                    {name: 'note', type: 'note'},
                    {name: 'button', type: 'button'}
                ]
            });

            var div = document.createElement('div');
            div.innerHTML = dlg.html();
            var divDialog = div.firstChild;
            divDialog.style.border = "2px solid black";
            divDialog.style.margin = "5px";
            divDialog.style.padding = "5px";
            divStage.appendChild(div);

            var values = {
                'default': 'default string',
                'text': 'text string',
                'check': true,
                'value': 'value string',
                'password': 'secret',
                'note': "this is a long\nnote"
            };

            dlg.setValues(values);
            var v2 = dlg.getValues();

            var rcDialog = dom.getRect(divDialog);
            redBox(rcDialog);
            for (var i = 0; i < dlg.fields.length; i++) {
                var field = dlg.fields[i];
                var name = field.name;
                var elt = field.elt;
                var rcField = dom.getRect(elt);

                ut.trace(name);

                ut.assertEq(values[name], v2[name]);

                redBox(rcField);

                ut.assert(vector.ptInRect(vector.ul(rcField), rcDialog) &&
                          vector.ptInRect(vector.lr(rcField), rcDialog),
                          "outside of dialog");
            }

            ts.coverage.cover('Dialog:enableField');
        }).require('document');

    }; // addTests

}); // org.startpad.dialog.test
