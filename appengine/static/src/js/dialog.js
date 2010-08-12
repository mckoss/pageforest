namespace.lookup('org.startpad.dialog').defineOnce(function(ns) {
    var util = namespace.util;
    var base = namespace.lookup('org.startpad.base');

    var patterns = {
        title: '<h1>{title}</h1>',
        text: '<label>{label}:</label>' +
            '<input id="{id}" type="text" value="{value}"/>',
        password: '<label>{label}:</label><input id="{id}" type="password"/>',
        checkbox: '<label class="checkbox" for="{id}">' +
            '<input id="{id}" type="checkbox"/>{label}</label>',
        note: '<label>{label}:</label>' +
            '<textarea id="{id}" rows="{rows}">{value}</textarea>',
        message: '<span id="{id}">{value}</span>',
        button: '<input id="{id}" type="button" value="{label}"/>',
        invalid: '***missing field type: {type}***'
    };

    // Dialog options:
    // focus: field name for initial focus
    // enter: fiend name to press for enter key
    // message: field to use to display messages
    // fields: array of fields with props:
    //     name/type/label/value/required/shortLabel/hidden
    function Dialog(options) {
        this.prefix = 'pfD';
        this.values = {};
        namespace.extendObject(this, options);
    }

    Dialog.methods({
        html: function(values) {
            var stb = new base.StBuf();
            base.forEach(this.fields, function(field, i) {
                field.id = this.prefix + i;
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
                if (values[field.name] != undefined) {
                    field.value = values[field.name];
                }
                stb.append(base.replaceKeys(patterns[field.type], field));
            });
            return stb.toString();
        },

        init: function() {
            base.forEach(this.fields, function(field) {
                if (field.hidden) {
                    var elt = document.getElementById(field.id);
                    elt.style.display = "none";
                }
            });
        }
    });

    namespace.extend({
        'Dialog': Dialog
    });
});
