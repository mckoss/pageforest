# JSON-P #

  * Pro: Already supported by jQuery.
  * Con: Only for GET requests.
  * Con: No response on error.

# Proxy server #

  * Pro: works for GET, POST, PUT, HEAD, DELETE.
  * Con: Need to install proxy on origin server.

# IFrames #

  * Con: cannot access parent JavaScript from inside the IFrame.

# Flash #

  * Con: heavy and proprietary.
  * Con: not supported on some devices (iPhone/iPad).

# Same origin only #

  * Host everything on the same domain for each pageforest app, e.g. chess.pageforest.com.

# Same parent domain #

  * Master page e.g. from www.pageforest.com.
  * IFrame page e.g. from chess.pageforest.com.
  * Set document.domain to pageforest.com with JavaScript.