from google.appengine.ext import db
import datetime

from utils.middleware import RequestMiddleware
from utils.http import http_datetime


class Timestamped(db.Model):
    """
    Standardized timestamp information for models.
    """

    created = db.DateTimeProperty(auto_now_add=True)
    created_ip = db.StringProperty()
    modified = db.DateTimeProperty()
    modified_ip = db.StringProperty()

    @classmethod
    def json_props(cls):
        props = super(Timestamped, cls).json_props()
        props.update(dict.fromkeys(('created', 'modified')))
        return props

    def put(self, *args, **kwargs):
        """
        Update the timestamps before each datastore write.
        """
        request = RequestMiddleware.get_request()
        if request and 'REMOTE_ADDR' in request.META:
            self.modified_ip = request.META['REMOTE_ADDR']
            if self.created_ip is None:
                self.created_ip = request.META['REMOTE_ADDR']

        # Don't rely on auto_now property to set the modification
        # time since it does not seem to be over-written in the model
        # after a put().
        self.modified = datetime.datetime.now()
        super(Timestamped, self).put(*args, **kwargs)

    def update_headers(self, response):
        response['Last-Modified'] = http_datetime(self.modified)
        response['X-Last-Modified-ISO'] = self.modified.isoformat() + 'Z'
        super(Timestamped, self).update_headers(response)
