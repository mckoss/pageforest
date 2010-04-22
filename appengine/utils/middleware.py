import threading


class RequestMiddleware(object):
    thread_local = threading.local()

    def process_request(self, request):
        self.thread_local.request = request

    @classmethod
    def get_request(cls):
        if not hasattr(cls.thread_local, 'request'):
            return None
        return cls.thread_local.request
