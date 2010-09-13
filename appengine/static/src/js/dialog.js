namespace.lookup('org.startpad.dialog').defineOnce(function(ns) {
    var util = namespace.util;
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');
    var dom = namespace.lookup('org.startpad.dom');

    var patterns = {
        title: '<h1>{title}</h1>',
        text: '<label class="left" for="{id}">{label}:</label>' +
            '<input id="{id}" type="text"/>',
        password: '<label class="left" for="{id}">{label}:</label>' +
            '<input id="{id}" type="password"/>',
        checkbox: '<label class="checkbox" for="{id}">' +
            '<input id="{id}" type="checkbox"/>&nbsp;{label}</label>',
        note: '<label class="left" for="{id}">{label}:</label>' +
            '<textarea id="{id}" rows="{rows}"></textarea>',
        message: '<div class="message" id="{id}"></div>',
        value: '<label class="left">{label}:</label>' +
            '<div class="value" id="{id}"></div>',
        button: '<input id="{id}" type="button" value="{label}"/>',
        invalid: '<span class="error">***missing field type: {type}***</span>',
        end: '<div style="clear: both;"></div>'
    };

    var defaults = {
        note: {rows: 5}
    };

    var sDialog = '<div class="{dialogClass}" id="{id}">{content}</div>';

    var cDialogs = 0;

    // Dialog options:
    // focus: field name for initial focus (if different from first)
    // enter: fiend name to press for enter key
    // message: field to use to display messages
    // fields: array of fields with props:
    //     name/type/label/value/required/shortLabel/hidden
    function Dialog(options) {
        cDialogs++;
        this.dialogClass = 'SP_Dialog';
        this.prefix = 'SP' + cDialogs + '_';
        this.bound = false;
        util.extendObject(this, options);
    }

    Dialog.methods({
        html: function() {
            var self = this;
            var stb = new base.StBuf();
            this.id = this.prefix + 'dialog';
            base.forEach(this.fields, function(field, i) {
                field.id = self.prefix + i;
                base.extendIfMissing(field, defaults[field.type]);
                if (field.type == undefined) {
                    field.type = 'text';
                }
                if (patterns[field.type] == undefined) {
                    field.type = 'invalid';
                }
                if (field.label == undefined) {
                    field.label = field.name[0].toUpperCase() +
                        field.name.slice(1);
                }
                stb.append(format.replaceKeys(patterns[field.type], field));
            });
            stb.append(patterns['end']);
            this.content = stb.toString();
            return format.replaceKeys(sDialog, this);
        },

        bindFields: function() {
            if (this.bound) {
                return;
            }
            this.bound = true;

            var self = this;

            self.dlg = document.getElementById(self.id);
            if (self.dlg == undefined) {
                throw new Error("Dialog not available.");
            }

            base.forEach(this.fields, function(field) {
                field.elt = document.getElementById(field.id);
                if (!field.elt) {
                    return;
                }

                if (field.onClick != undefined) {
                    dom.bind(field.elt, 'click', function() {
                        field.onClick();
                    });
                }

                // Default focus is on the first text-entry field.
                if (self.focus == undefined &&
                    (field.elt.tagName == 'INPUT' ||
                     field.elt.tagName == 'TEXTAREA')) {
                    self.focus = field.name;
                }

                // First button defined gets the enter key
                if (self.enter == undefined && field.type == 'button') {
                    self.enter = field.name;
                }
            });

            if (self.enter) {
                dom.bind(self.dlg, 'keydown', function(evt) {
                    if (evt.keyCode == 13) {
                        var field = self.getField(self.enter);
                        if (field.onClick) {
                            field.onClick();
                        }
                    }
                });
            }
        },

        getField: function(name) {
            for (var i = 0; i < this.fields.length; i++) {
                if (this.fields[i].name == name) {
                    return this.fields[i];
                }
            }
            return undefined;
        },

        // Call just before displaying a dialog to set it's values.
        setValues: function(values) {
            var field;

            this.bindFields();
            for (var name in values) {
                if (values.hasOwnProperty(name)) {
                    field = this.getField(name);
                    if (field == undefined || field.elt == undefined) {
                        continue;
                    }
                    var value = values[name];
                    if (value == undefined) {
                        value = '';
                    }
                    switch (field.elt.tagName) {
                    case 'INPUT':
                        switch (field.elt.type) {
                        case 'checkbox':
                            field.elt.checked = value;
                            break;
                        case 'text':
                        case 'password':
                            field.elt.value = value;
                            break;
                        default:
                            break;
                        }
                        break;

                    case 'TEXTAREA':
                        field.elt.value = value;
                        break;

                    default:
                        dom.setText(field.elt, value);
                        break;
                    }
                }
            }
        },

        setFocus: function() {
            var field;
            this.bindFields();
            if (this.focus) {
                field = this.getField(this.focus);
                if (field) {
                    field.elt.focus();
                    field.elt.select();
                }
            }
        },

        getValues: function() {
            var values = {};

            this.bindFields();
            for (var i = 0; i < this.fields.length; i++) {
                var field = this.fields[i];
                if (field.elt == undefined) {
                    continue;
                }
                var name = field.name;
                switch (field.elt.tagName) {
                case 'INPUT':
                    switch (field.elt.type) {
                    case 'checkbox':
                        values[name] = field.elt.checked;
                        break;
                    case 'text':
                    case 'password':
                        values[name] = field.elt.value;
                        break;
                    default:
                        break;
                    }
                    break;

                case 'TEXTAREA':
                    values[name] = field.elt.value;
                    break;

                default:
                    values[name] = dom.getText(field.elt);
                    break;
                }
            }

            return values;
        },

        enableField: function(name, enabled) {
            if (enabled == undefined) {
                enabled = true;
            }
            this.bindFields();
            var field = this.getField(name);
            switch (field.elt.tagName) {
            case 'INPUT':
            case 'TEXTAREA':
                field.elt.disabled = !enabled;
                break;

            case 'DIV':
                field.elt.style.display = enabled ? 'block' : 'none';
                break;

            default:
                throw new Error("Field " + name + " is not a form field.");
            }
        }
    });

    ns.extend({
        'Dialog': Dialog
    });
});
