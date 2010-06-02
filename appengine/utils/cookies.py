import Cookie

from django.conf import settings


class NewMorsel(Cookie.Morsel):
    """
    Add support for HttpOnly cookies before Python 2.6.
    """

    def __setitem__(self, K, V):
        K = K.lower()
        if K == "httponly":
            dict.__setitem__(self, K, V)
        else:
            super(NewMorsel, self).__setitem__(K, V)

    def OutputString(self, attrs=None):
        output = super(NewMorsel, self).OutputString(attrs)
        if self.get("httponly", "") and '; httponly' not in output.lower():
            output += "; HttpOnly"
        return output


class NewCookie(Cookie.SimpleCookie):
    """
    Cookie dictionary using the NewMorsel subclass above.
    """

    def __set(self, key, real_value, coded_value):
        M = self.get(key, NewMorsel())
        M.set(key, real_value, coded_value)
        dict.__setitem__(self, key, M)

    def __setitem__(self, key, value):
        rval, cval = self.value_encode(value)
        self.__set(key, rval, cval)


class HttpOnlyMiddleware:
    """
    Replace the response cookie to add support for HttpOnly.
    """

    def process_response(self, request, response):
        original = response.cookies
        response.cookies = NewCookie()
        for name in original:
            response.cookies[name] = original[name].value
            response.cookies[name].update(original[name])
            if name not in settings.JAVASCRIPT_READABLE_COOKIES:
                response.cookies[name]['httponly'] = "true"
        return response
