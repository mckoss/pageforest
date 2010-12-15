from  hashlib import sha1

from django.utils import simplejson as json

from google.appengine.ext import db
from google.appengine.datastore import entity_pb

from utils.json import ModelEncoder


class Serializable(db.Model):

    def to_protobuf(self):
        """
        Serialize a datastore entity to a protocol buffer.
        """
        return db.model_to_protobuf(self).Encode()

    @classmethod
    def from_protobuf(cls, binary):
        """
        Restore an entity from a binary protocol buffer.
        """
        return db.model_from_protobuf(entity_pb.EntityProto(binary))

    def to_json(self, extra=None, include=None, exclude=None, indent=2):
        """
        Serialize a datastore entity to JSON.
        """
        result = {}
        for name in self.properties():
            if exclude and name in exclude:
                continue
            if include and name not in include:
                continue
            result[name] = getattr(self, name)
        if extra:
            result.update(extra)
        if indent is None:
            return json.dumps(result, sort_keys=True, cls=ModelEncoder)
        else:
            return json.dumps(result, sort_keys=True, cls=ModelEncoder,
                              indent=indent, separators=(',', ': ')) + '\n'


class Hashable(Serializable):
    """
    A model with a sha1 and size attribute.  Can generate ETags.

    The hash and size are based on the JSON representation of the model
    as defined by self.to_json().
    """
    sha1 = db.StringProperty()
    size = db.IntegerProperty()

    def get_etag(self):
        """Return ETag for use in the HTTP header."""
        return '"%s"' % self.sha1

    def update_hash(self, value=None):
        if value is None:
            value = self.to_json(exclude=('sha1', 'size'))
        self.sha1 = sha1(value).hexdigest()
        self.size = len(value)

    def update_headers(self, response):
        response['ETag'] = self.get_etag()
        # Hashable is the end of the MRO chain - don't call super
