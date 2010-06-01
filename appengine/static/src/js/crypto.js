/*
 * Crypto-JS v2.0.0
 * http://code.google.com/p/crypto-js/
 * Copyright (c) 2009, Jeff Mott. All rights reserved.
 * http://code.google.com/p/crypto-js/wiki/License
 */

//////////////////////////////// Crypto.js ////////////////////////////////

(function () {

/* Global crypto object
 ---------------------------------------------------------------------------- */
var C = Crypto = {};

/* Types
 ---------------------------------------------------------------------------- */
var types = C.types = {};

/* Word arrays
 ------------------------------------------------------------- */
var WordArray = types.WordArray = {

    // Get significant bytes
    getSigBytes: function (words) {
        if (words["_Crypto"] && words["_Crypto"].sigBytes != undefined) {
            return words["_Crypto"].sigBytes;
        } else {
            return words.length * 4;
        }
    },

    // Set significant bytes
    setSigBytes: function (words, n) {
        words["_Crypto"] = { sigBytes: n };
    },

    // Concatenate word arrays
    cat: function (w1, w2) {
        return ByteStr.decode(ByteStr.encode(w1) + ByteStr.encode(w2));
    }

};

/* Encodings
 ---------------------------------------------------------------------------- */
var enc = C.enc = {};

/* Byte strings
 ------------------------------------------------------------- */
var ByteStr = enc.ByteStr = {

    encode: function (words) {

        var sigBytes = WordArray.getSigBytes(words);
        var str = [];

        for (var i = 0; i < sigBytes; i++) {
            str.push(String.fromCharCode((words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xFF));
        }

        return str.join("");

    },

    decode: function (str) {

        var words = [];

        for (var i = 0; i < str.length; i++) {
            words[i >>> 2] |= str.charCodeAt(i) << (24 - (i % 4) * 8);
        }
        WordArray.setSigBytes(words, str.length);

        return words;

    }

};

/* UTF8 strings
 ------------------------------------------------------------- */
enc.UTF8 = {

    encode: function (words) {
        return decodeURIComponent(escape(ByteStr.encode(words)));
    },

    decode: function (str) {
        return ByteStr.decode(unescape(encodeURIComponent(str)));
    }

};

/* Word arrays
 ------------------------------------------------------------- */
enc.Words = {
    encode: function (words) { return words; },
    decode: function (words) { return words; }
};

})();

//////////////////////////////// SHA1.js ////////////////////////////////

(function () {

// Shortcuts
var C = Crypto;
var UTF8 = C.enc.UTF8;
var WordArray = C.types.WordArray;

// Public API
var SHA1 = C.SHA1 = function (message, options) {

    // Digest
    var digestWords = SHA1.digest(message);

    // Set default output
    var output = options && options.output || C.enc.Hex;

    // Return encoded output
    return output.encode(digestWords);

};

// The core
SHA1.digest = function (message) {

    // Convert to words, else assume words already
    var m = message.constructor == String ? UTF8.decode(message) : message;

    // Add padding
    var l = WordArray.getSigBytes(m) * 8;
    m[l >>> 5] |= 0x80 << (24 - l % 32);
    m[(((l + 64) >>> 9) << 4) + 15] = l;

    // Initial values
    var w  = [];
    var H0 = 0x67452301;
    var H1 = 0xEFCDAB89;
    var H2 = 0x98BADCFE;
    var H3 = 0x10325476;
    var H4 = 0xC3D2E1F0;

    for (var i = 0; i < m.length; i += 16) {

        var a = H0;
        var b = H1;
        var c = H2;
        var d = H3;
        var e = H4;

        for (var j = 0; j < 80; j++) {

            if (j < 16) w[j] = m[i + j];
            else {
                var n = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
                w[j] = (n << 1) | (n >>> 31);
            }

            var t = ((H0 << 5) | (H0 >>> 27)) + H4 + (w[j] >>> 0) + (
                     j < 20 ? ((H1 & H2) | (~H1 & H3))            + 0x5A827999 :
                     j < 40 ?  (H1 ^ H2 ^ H3)                     + 0x6ED9EBA1 :
                     j < 60 ? ((H1 & H2) | (H1 & H3) | (H2 & H3)) - 0x70E44324 :
                               (H1 ^ H2 ^ H3)                     - 0x359D3E2A);

            H4 = H3;
            H3 = H2;
            H2 = (H1 << 30) | (H1 >>> 2);
            H1 = H0;
            H0 = t;

        }

        H0 += a;
        H1 += b;
        H2 += c;
        H3 += d;
        H4 += e;

    }

    return [H0, H1, H2, H3, H4];

};

// Block size
SHA1.blockSize = 16;

})();

//////////////////////////////// HMAC.js ////////////////////////////////

(function () {

// Shortcuts
var C = Crypto;
var UTF8 = C.enc.UTF8;
var Words = C.enc.Words;
var WordArray = C.types.WordArray;

C.HMAC = function (hasher, message, key, options) {

    // Convert to words, else assume words already
    var m = message.constructor == String ? UTF8.decode(message) : message;
    var k = key.constructor == String ? UTF8.decode(key) : key;

    // Allow arbitrary length keys
    if (k.length > hasher.blockSize) {
        k = hasher(k, { output: Words });
    }

    // XOR keys with pad constants
    var oKey = k.slice(0);
    var iKey = k.slice(0);
    for (var i = 0; i < hasher.blockSize; i++) {
        oKey[i] ^= 0x5C5C5C5C;
        iKey[i] ^= 0x36363636;
    }

    // Hash
    var hmacWords = hasher(WordArray.cat(oKey, hasher(WordArray.cat(iKey, m), { output: Words })), { output: Words });

    // Set default output
    var output = options && options.output || C.enc.Hex;

    // Return encoded output
    return output.encode(hmacWords);

};

})();
