# Create a pageforest app #

Register a new app and choose a name for it, e.g. "chess". This creates the subdomain chess.pageforest.com where the new app will be hosted. You don't need to register your own domain name.

# HTML, CSS, images #

Static content is hosted on your subdomain. You can upload your own HTML, CSS and images, or you can start with the default templates and edit them in your browser. You don't need to maintain your own server for static file hosting.

# JavaScript #

You can upload your JavaScript and/or edit it directly in your browser. The editor is available on the same page where your web app is running. When you hit the Save button, your web app is reloaded with the new JavaScript code. Your application state is automatically saved and restored during the JavaScript upgrade, so you don't have to restart the chess game every time you change the source code.

# Same-origin policy #

Giving each pageforest app a separate subdomain and hosting the static files there lets us use JavaScript's same-origin policy to keep each application inside its own storage namespace, and reduces cross-site scripting vulnerabilities. (The work-arounds listed on the SameOriginPolicy page are not required.)

# Separate domains #

If a developer wants to use her own domain www.example.com rather than appname.pageforest.com, here are a few options for that:

  * URL cloaking with a proxy on www.example.com.
  * For a monthly fee, we can add www.example.com to our central pageforest project on App Engine (using Google Apps) and deliver services through this domain.
  * Let the developer start a new App Engine project, deploy pageforest on it, connect it to www.example.com via Google Apps, have complete separation from pageforest.com (maintenance and billing). Even if pageforest wasn't open source, we could deploy it for them after they invite support@pageforest.com as a developer to their App Engine project.