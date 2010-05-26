from django.conf import settings

import Cookie


class Morsel(Cookie.Morsel):
    """
    Provide support for HttpOnly cookies before Python 2.6.
    """

    def __setitem__(self, K, V):
        K = K.lower()
        if K == "httponly":
            dict.__setitem__(self, K, V)
        else:
            super(Morsel, self).__setitem__(K, V)

    def OutputString(self, attrs=None):
        output = super(Morsel, self).OutputString(attrs)
        if self.get("httponly", "") and 'httponly' not in output.lower():
                output += "; HttpOnly"
        return output

    def debug(self):
        print 'key:', self.key
        print 'value:', self.value
        print 'coded:', self.coded_value
        for key in self:
            if self[key]:
                print key + ':', self[key]


class SimpleCookie(Cookie.SimpleCookie):
    """
    Cookie dictionary using our own Morsel subclass above.
    """

    def __set(self, key, real_value, coded_value):
        M = self.get(key, Morsel())
        M.set(key, real_value, coded_value)
        dict.__setitem__(self, key, M)

    def __setitem__(self, key, value):
        rval, cval = self.value_encode(value)
        self.__set(key, rval, cval)


# REVIEW: Our sessionkey cookie is quoted with double quotes (")
# because it contains forward slash (/). According to RFC 2068, the
# following characters are not allowed in tokens:
#
#          tspecials      = "(" | ")" | "<" | ">" | "@"
#                         | "," | ";" | ":" | "\" | <">
#                         | "/" | "[" | "]" | "?" | "="
#                         | "{" | "}" | SP | HT
#
# According to the Cookie module in the Python 2.5 stdlib, the
# following characters are legal and don't need quotes:
# _LegalChars = string.ascii_letters + string.digits + "!#$%&'*+-.^_`|~"


class HttpOnlyMiddleware:

    def process_response(self, request, response):
        if settings.SESSION_COOKIE_NAME in response.cookies:
            original = response.cookies
            response.cookies = SimpleCookie()
            for name in original:
                response.cookies[name] = original[name].value
                response.cookies[name].update(original[name])
                if not name.endswith('_exists'):
                    response.cookies[name]['httponly'] = "true"
        return response
