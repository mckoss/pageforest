global_namespace.define('com.pageforest.cookies', function(ns) {
    /*
    Client-side cookie reader and writing helper.

    Cookies can be quoted with "..." if they have spaces or other
    special characters. Internal quotes may be escaped with a \
    character These routines use encodeURIComponent to safely encode
    and decode all special characters.
    */
    var misc = ns.lookup('com.pageforest.misc');

ns.extend(ns, {
setCookie: function(name, value, days, path) {
    var expires = '';
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = '; expires=' + date.toGMTString();
    }
    path = '; path=' + (path || '/');
    document.cookie =
        encodeURIComponent(name) + '=' + encodeURIComponent(value)
        + expires + path;
},

getCookie: function(name) {
    return ns.getCookies()[name];
},

getCookies: function(name) {
    var st = document.cookie;
    var rgPairs = st.split(";");

    var obj = {};
    for (var i = 0; i < rgPairs.length; i++) {
        // document.cookie never returns ;max-age, ;secure, etc. - just name value pairs
        rgPairs[i] = misc.strip(rgPairs[i]);
        var rgC = rgPairs[i].split("=");
        var val = decodeURIComponent(rgC[1]);
        // Remove quotes around value string if any (and also replaces \" with ")
        var rg = val.match('^"(.*)"$');
        if (rg)
            val = rg[1].replace('\\"', '"');
        obj[decodeURIComponent(rgC[0])] = val;
    }
    return obj;

}}); // ns

}); // com.pageforest.cookies
