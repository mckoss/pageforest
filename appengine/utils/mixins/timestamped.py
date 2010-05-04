from google.appengine.ext import db

from utils.middleware import RequestMiddleware


class Timestamped(db.Model):
    """
    Standardized timestamp information for models.
    """
    created = db.DateTimeProperty(auto_now_add=True)
    created_ip = db.StringProperty()
    modified = db.DateTimeProperty(auto_now=True)
    modified_ip = db.StringProperty()

    def put(self, *args, **kwargs):
        """
        Update the timestames before each datastore write.
        """
        request = RequestMiddleware.get_request()
        if request and 'REMOTE_ADDR' in request.META:
            self.modified_ip = request.META['REMOTE_ADDR']
            if not self.is_saved():
                self.created_ip = request.META['REMOTE_ADDR']
        super(Timestamped, self).put(*args, **kwargs)
