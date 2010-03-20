from django.http import HttpResponse


class HttpResponseCreated(HttpResponse):
    status_code = 201

    def __init__(self, location):
        HttpResponse.__init__(self)
        self['Location'] = location
