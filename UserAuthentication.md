# Points to consider #

  * Cross-domain / Cross-site access restrictions
    * App developer maintains a list of trusted domains for each app
    * Let textpad.com save data to textpad.pageforest.com
    * Reject access from malicious.com by checking the referer

# Details #

  * User authentication uses username + password
    * Users may supply email address instead of username
    * In the future, users may authenticate with OpenID / OAuth / Facebook Connect

  * User login creates a cookie in the browser for pageforest.com
    * This cookie is transmitted with each request to app\_id.pageforest.com
    * If the app is hosted on textpad.com, the textpad.appengine.com cookie will not be readable directly from JavaScript, but there will be a server API that returns the cookie data if JavaScript needs it.

  * User may start using an app without registration or login
    * Login is required before creating a document
    * Modifying an existing document may be allowed without login, if the document owner has enabled public write access
    * Maybe enforce stricter limitations for public writable documents, e.g. smaller maximum size

# Requirements #

  1. Never transmit plain password (use SHA-1).
  1. Avoid HTTPS if possible.
  1. Prevent replay attacks.
  1. No extra HTTP request to get nonce before each API request.
  1. Simple implementation on the JavaScript side.
  1. Different apps in the same browser should authenticate independently.
  1. Cross-domain support (JSONP) but XSS security (check Referer header).
  1. Remember login across browser sessions (cookie or HTML5 storage).
  1. Login should work even if cookies are disabled.
  1. Don't re-invent the wheel (if possible).
  1. Efficiency - minimize CPU and database lookups
  1. Server side must be safe from timing attacks.
  1. The separator character must be disallowed in all values.

# Implementation #

  * rid: request ID, e.g. 2010-04-14T07:47:32ZAq8eFkoI (ISO timestamp + random).
    * Random should contain at least 40 bits of entropy to ensure that multiple clients running on the user's behalf will not generate the same rid.
  * app: the application identifier.
  * user: the user name.
  * pass: the user's password.
  * SA: app-specific random secret
  * H(): one-way hash function, e.g. SHA-1.
  * S(string, secret) = string$H(string$secret)
  * $: separator, must be disallowed in components.

## Account registration ##

  * Client sends user, H(user$pass) - both stored on the server

Ideally, this is performed over an SSL connection.  This should be the ONLY
time the long-lived shared secret H(user$pass) is transmitted to the server.

## Login ##

  * Client requests https://auth.app.pageforest.com/challenge (SSL preferred)
  * If a valid reauthorization cookie is NOT provided:
    * Server returns challenge = S(random$expires, SA) - expires: now + 1 minute
    * Client responds with user$S(challenge, H(user$pass))
    * Server expires the challenge once it is used, to prevent replay attacks.
  * Server responds with:
    * session\_key = S(app$user$expires, H(user$pass)$SA) - expires: now + 24 hours
    * reauthorization cookie = S(app$user$expires, H(user$pass)$SA) - expires: now + 30 days
      * By including the H(user$pass) in the hash of the cookies, all reauthorization cookies and session keys will be immediately invalidated if a user changes their password.

In the more complex version of this protocol (which is resistant to replay attacks), the
session\_key is never transmitted in the clear, but rather is used to sign the request id (below).

In a simplified version, the client either sets the session\_key in a first-party cookie
or sends a request to http://app.pageforest.com/ to have the server assign it.

### Notes ###

<i>
The reauthorization cookie is only refreshed when a client responds<br>
with a correct challenge response (we do not refresh the cookie on every login<br>
since that would enable a malicious user to maintain another user's login<br>
indefinitely).<br>
</i>

## Logout ##

  * Client visits https://auth.app.pageforest.com/logout and server expires the reauthorization cookie as well as the current session\_cookie on http://app.pageforest.com

## Request authentication ##

  * Sign each request with user$expires$S(rid, session\_key)

Or, in the simplified version, simply setting the session\_key in a first-party cookie
on http://app.pageforest.com.

  * auth = session\_key