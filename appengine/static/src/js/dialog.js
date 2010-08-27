namespace.lookup('org.startpad.dialog').defineOnce(function(ns) {
    var util = namespace.util;
    var base = namespace.lookup('org.startpad.base');
    var format = namespace.lookup('org.startpad.format');

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
        message: '<div id="{id}"></div>',
        value: '<label class="left">{label}:</label>' +
            '<div class="value" id="{id}"></div>',
        button: '<input id="{id}" type="button" value="{label}"/>',
        invalid: '<span class="error">***missing field type: {type}***</span>'
    };

    var sDialog = '<div class="{prefix}Dialog">{content}</div>';

    // Dialog options:
    // focus: field name for initial focus
    // enter: fiend name to press for enter key
    // message: field to use to display messages
    // fields: array of fields with props:
    //     name/type/label/value/required/shortLabel/hidden
    function Dialog(options) {
        this.prefix = 'SP_';
        this.bound = false;
        util.extendObject(this, options);
    }

    Dialog.methods({
        html: function() {
            var self = this;
            var stb = new base.StBuf();
            base.forEach(this.fields, function(field, i) {
                field.id = self.prefix + i;
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
            this.content = stb.toString();
            return format.replaceKeys(sDialog, this);
        },

        bindFields: function() {
            if (this.bound) {
                return;
            }
            var self = this;
            base.forEach(this.fields, function(field) {
                field.elt = document.getElementById(field.id);
                if (field.onClick != undefined) {
                    $(field.elt).click(
                        self.onButton.fnMethod(self).fnArgs(field));
                }
            });
            this.bound = true;
        },

        onButton: function(evt, field) {
            field.onClick();
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
            this.bindFields();
            for (var name in values) {
                if (values.hasOwnProperty(name)) {
                    var field = this.getField(name);
                    if (field == undefined || field.elt == undefined) {
                        continue;
                    }
                    var value = values[name];
                    switch (field.elt.tagName) {
                    case 'INPUT':
                        switch (field.elt.type) {
                        case 'checkbox':
                            field.elt.checked = value;
                            break;
                        case 'text':
                            $(field.elt).val(value);
                            break;
                        default:
                            break;
                        }
                        break;

                    case 'TEXTAREA':
                        $(field.elt).val(value);
                        break;

                    default:
                        $(field.elt).text(value);
                        break;
                    }
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
                switch (field.elt.tagName) {
                case 'INPUT':
                    switch (field.elt.type) {
                    case 'checkbox':
                        values[field.name] = field.elt.checked;
                        break;
                    case 'text':
                        values[field.name] = $(field.elt).val();
                        break;
                    default:
                        break;
                    }
                    break;

                case 'TEXTAREA':
                    values[field.name] = $(field.elt).val();
                    break;

                default:
                    break;
                }
            }

            return values;
        }
    });

    ns.extend({
        'Dialog': Dialog
    });
});
