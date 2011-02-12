namespace.lookup('org.startpad.dialog').defineOnce(function(ns) {
    var util = namespace.util;
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');
    var dom = namespace.lookup('org.startpad.dom');

    var defaultPatterns = {
        title: {useRow: 'spanRow', content: '<h1>{title}</h1>'},
        text: {content: '<input id="{id}" type="text"/>'},
        password: {content: '<input id="{id}" type="password"/>'},
        checkbox: {label: '',
                   content: '<label class="checkbox" for="{id}">' +
                            '<input id="{id}" type="checkbox"/>&nbsp;{label}</label>'},
        note: {content: '<textarea id="{id}" rows="{rows}"></textarea>'},
        message: {useRow: 'spanRow', content: '<div class="message" id="{id}"></div>'},
        value: {label: '<label class="left">{label}:</label>',
                content: '<div class="value" id="{id}"></div>'},
        button: {content: '<input id="{id}" type="button" value="{label}"/>'},
        invalid: {useRow: 'spanRow',
                  content: '<span class="error">***missing field type: {type}***</span>'}
    };

    var defaultFieldOptions = {
        note: {rows: 5}
    };

    var styles = {
        div: {
            label: '<label class="left" for="{id}">{label}:</label>',
            content: '<input id="{id}" type="text"/>',
            spanRow: '{content}\n',
            row: "{label}{content}\n",
            post: '<div style="clear: both;"></div>\n'
        },
        table: {
            pre: "<table>\n",
            label: '<label class="left" for="{id}">{label}:</label>',
            content: '<input id="{id}" type="text"/>',
            spanRow: "<tr><td columns=2>{content}</td></tr>",
            row: "<tr><th>{label}</th><td>{content}</td></tr>\n",
            post: "</table>\n"
        }
    };

    var sDialog = '<div class="{dialogClass}" id="{id}">\n' +
        '{pre}\n{content}\n{post}\n' +
        '</div>';

    var cDialogs = 0;

    // Dialog options:
    // focus: field name for initial focus (if different from first)
    // enter: field name to press for enter key
    // message: field to use to display messages
    // fields: array of fields with props:
    //     name/type/label/value/required/shortLabel/hidden/onClick/onChange
    function Dialog(options) {
        cDialogs++;
        this.dialogClass = 'SP_Dialog';
        this.prefix = 'SP' + cDialogs + '_';
        this.bound = false;
        this.lastValues = {};
        this.patterns = defaultPatterns;
        this.fieldOptions = defaultFieldOptions;
        this.style = styles.div;
        util.extendObject(this, options);
    }

    Dialog.methods({
        html: function() {
            var self = this;
            var stb = new base.StBuf();
            this.id = this.prefix + 'dialog';
            base.forEach(this.fields, function(field, i) {
                field.id = self.prefix + i;
                if (field.type == undefined) {
                    field.type = 'text';
                }
                base.extendIfMissing(field, self.fieldOptions[field.type]);
                if (self.patterns[field.type] == undefined) {
                    field.type = 'invalid';
                }
                if (field.label == undefined) {
                    field.label = field.name[0].toUpperCase() +
                        field.name.slice(1);
                }
                var fieldPatterns = base.extendIfMissing({}, self.patterns[field.type],
                        base.project(self.style, ['label', 'content']));
                var row = {label: fieldPatterns.label.format(field),
                           content: fieldPatterns.conten.format(field)};
                var rowPattern = field.useRow ? this.style[field.useRow] : this.style.row;
                stb.append(rowPattern.format(row));
            });
            this.content = stb.toString();
            var s = format.replaceKeys(sDialog, this);
            return s;
        },

        bindFields: function() {
            if (this.bound) {
                return;
            }
            this.bound = true;

            var self = this;

            self.dlg = document.getElementById(self.id);
            if (self.dlg == undefined) {
                throw new Error("Dialog not in the DOM.");
            }

            var initialValues = {};

            base.forEach(this.fields, function(field) {
                field.elt = document.getElementById(field.id);
                if (!field.elt) {
                    return;
                }

                if (field.value) {
                    initialValues[field.name] = field.value;
                }

                if (field.onClick != undefined) {
                    dom.bind(field.elt, 'click', function(evt) {
                        field.onClick(evt, field);
                    });
                }

                // Bind to chaning field (after it's changed - use keyUp)
                if (field.onChange != undefined) {
                    dom.bind(field.elt, 'keyup', function(evt) {
                        field.onChange(evt, field.elt.value);
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

            this.setValues(initialValues);
        },

        getField: function(name) {
            for (var i = 0; i < this.fields.length; i++) {
                if (this.fields[i].name == name) {
                    return this.fields[i];
                }
            }
            return undefined;
        },

        // Compare current value with last externally set value
        hasChanged: function(name) {
            // REVIEW: This could be more effecient
            var values = this.getValues();
            return values[name] != this.lastValues[name];
        },

        // Call just before displaying a dialog to set it's values.
        // REVIEW: should have a Field class and call field.set method
        setValues: function(values) {
            var field;

            base.extendObject(this.lastValues, values);

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
        'Dialog': Dialog,
        'styles': styles
    });
});
