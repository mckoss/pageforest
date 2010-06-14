#!/bin/sh
SRC=~/src/crypto-js/src
FILENAME=appengine/static/src/js/crypto.js
echo building: $FILENAME
cat <<EOF > $FILENAME
/*
 * Crypto-JS v2.0.0
 * http://code.google.com/p/crypto-js/
 * Copyright (c) 2009, Jeff Mott. All rights reserved.
 * http://code.google.com/p/crypto-js/wiki/License
 */
EOF
for module in Crypto Hex Base64 SHA1 HMAC
do
    echo >> $FILENAME
    echo //////////////////////////////// $module.js //////////////////////////////// >> $FILENAME
    echo >> $FILENAME
    cat $SRC/$module.js | recode /CRLF.. \
    | sed "s/C = Crypto = {}/C = Crypto/" \
    | sed "s/C = Crypto/C = namespace.lookup('com.googlecode.crypto-js')/" \
    >> $FILENAME
done
