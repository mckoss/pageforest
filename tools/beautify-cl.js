/*

 JS Beautifier Rhino command line script
----------------------------------------

  Written by Patrick Hof, <patrickhof@web.de>

  This script is to be run with Rhino[1], the JavaScript Engine written in Java,
  on the command line.

  Usage:
    java org.mozilla.javascript.tools.shell.Main beautify-cl.js

  You are free to use this in any way you want, in case you find this useful or working for you.

  [1] http://www.mozilla.org/rhino/

*/
load("beautify.js");
load("beautify-html.js");


function print_usage() {
    print("Usage: java org.mozilla.javascript.tools.shell.Main beautify-cl.js [options] [file || URL]\n");
    print("Reads from standard input if no file or URL is specified.\n");
    print("Options:");
    print("-i NUM\tIndent size (1 for TAB)");
    print("-b\tPut braces on own line (Allman / ANSI style)");
    print("-a\tIndent arrays");
    print("-n\tPreserve newlines");
    print("-p\tJSLint-pedantic mode, currently only adds space between \"function ()\"");
    print("-h\tPrint this help\n");
    print("Examples:");
    print("beautify-cl.js -i 2 example.js");
    print("beautify-cl.js -i 1 http://www.example.org/example.js\n");
}


function parse_opts(args) {
    var options = [];
    while (args.length > 0) {
        param = args.shift();
        if (param.substr(0, 1) == '-') {
            switch (param) {
            case "-i":
                options.indent = args.shift();
                break;
            case "-b":
                options.braces_on_own_line = true;
                break;
            case "-a":
                options.keep_array_indentation = false;
                break;
            case "-p":
                options.jslint_pedantic = true;
                break;
            case "-n":
                options.preserve_newlines = true;
                break;
            case "-h":
                print_usage();
                quit();
                break;
            default:
                print("Unknown parameter: " + param + "\n");
                print("Aborting.");
                quit();
            }
        } else {
            options.source = param;
        }
    }
    return options;
}


function do_js_beautify() {
    var js_source = '';
    if (options.source) { // Check if source argument is an URL
        if (options.source.substring(0, 4) === 'http') {
            js_source = readUrl(options.source);
        } else { // Otherwise, read from file
            js_source = readFile(options.source);
        }
    } else { // read from stdin
        importPackage(java.io);
        importPackage(java.lang);
        var stdin = new BufferedReader(new InputStreamReader(System['in']));
        var lines = [];

        // read stdin buffer until EOF
        while (stdin.ready()) {
            lines.push(stdin.readLine());
        }
        if (lines.length) js_source = lines.join("\n");

        if ( ! lines.length) {
            print_usage();
            quit();
        }
    }
    js_source = js_source.replace(/^\s+/, '');
    var indent_size = options.indent ? options.indent : 2;
    var preserve_newlines = options.preserve_newlines ? options.preserve_newlines : false;
    var indent_char = ' ';
    var result;
    if (indent_size == 1) {
        indent_char = '\t';
    }
    if (js_source && js_source[0] === '<') {
        result = style_html(js_source, indent_size, indent_char, 80);
    } else {
        result = js_beautify(js_source, {
            indent_size: indent_size,
            indent_char: indent_char,
            preserve_newlines: preserve_newlines,
            space_after_anon_function: options.jslint_pedantic,
            keep_array_indentation: options.keep_array_indentation,
            braces_on_own_line: options.braces_on_own_line
        });
    }
    return result;
}


options = parse_opts(arguments);
print(do_js_beautify());
