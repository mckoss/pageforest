// Bootstrap PF object and load other scripts
// This file to be replaced by static concatenation of source files before shipping
var PF = {

// Extend(dest, src1, src2, ... )
// Shallow copy properties in turn into dest object
Extend: function(dest)
    {
    for (var i = 1; i < arguments.length; i++)
        {
        var src = arguments[i];
        for (var prop in src)
            {
            if (src.hasOwnProperty(prop))
                dest[prop] = src[prop];
            }
        }
    },

HeadScript: function(url)
    {
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.src = url;
    head.appendChild(script);

    script = document.createElement('script');
    // Not working in IE - commented out for now
    //script.innerHTML = "if (console) console.log('" + url + " loaded: ', PF);";
    //var txt = document.createTextNode("if (console) console.log('" + url + " loaded: ', PF);");
    //script.appendChild(txt);
    //head.appendChild(script);
    document.write("<script>if (console) console.log('" + url + " loaded: ', PF);</script>");
    },

// Add stylesheet like: <link rel="stylesheet" type="text/css" href="blocks.css"/>
HeadStyle: function(url)
    {
    var head = document.getElementsByTagName('head')[0];
    var link = document.createElement('link');
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = url;
    head.appendChild(link);
    }
};  // PF

// Use global, pfroot, as pageforest server location if set
var pfroot;

(function (root)
{
    var scripts = [
        // BUG - can't load in BOTH IE and Firefox...also included firebug.appspot.com/firebug-lite.css?
        //"tests/firebug/pi.js",
        //"tests/firebug/firebug.js",
        "tests/firebug/firebugx.js",

        "scripts/base.js",
        "scripts/timer.js",
        "scripts/statemachine.js",
        "scripts/data.js",
        "scripts/pageforest.js",
        "scripts/sha1.js"
        ];
    if (console) console.log("Firebug console doesn't work w/o this line added up front?");
    PF.server = root;
    var head = document.getElementsByTagName('head')[0];
    for (var i = 0; i < scripts.length; i++)
        {
        PF.HeadScript(root + scripts[i]);
        }

    PF.HeadStyle(root + "styles/page.css");
})(pfroot || "http://test.pageforest.com/");
