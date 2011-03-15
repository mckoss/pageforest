import logging
import traceback

from  hashlib import sha1

from django.conf import settings
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

    @classmethod
    def json_props(cls):
        """
        Should be overwridden to return a dictionary of the properties
        to serialized in the form:

        { 'name': 'alias',
          'name': None,
           ...
        }

        The model property will always use 'name', but may be reperesented
        in the json blob as 'alias' (if given).
        """
        return {}

    def to_json(self, extra=None, include=None, exclude=None, indent=2):
        """
        Serialize a datastore entity to JSON.
        """
        if exclude is None:
            exclude = ()
        result = {}
        for name, alias in self.json_props().items():
            if exclude and name in exclude:
                continue
            if include and name not in include:
                continue
            if getattr(self, name) is not None:
                result[alias or name] = getattr(self, name)
        if extra:
            # Need to exclude even extra properties - may be computed and not
            # stored in model directly, but still not part of the hash when called
            # from Hashable.
            for prop, value in extra.items():
                if exclude and prop in exclude:
                    continue
                result[prop] = value
        if indent is None:
            return json.dumps(result, sort_keys=True,
                              separators=(',', ':'), cls=ModelEncoder)
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
        if sha1 is None:
            return None
        return '"%s"' % self.sha1

    @classmethod
    def nohash_props(cls):
        """
        List of properties to EXCLUDE from the hash.
        """
        return ('sha1', 'size')

    def update_hash(self, value=None):
        """
        Update the hash value of the model.
        """
        exclude = self.nohash_props()
        if value is None:
            value = self.to_json(exclude=exclude)
        self.sha1 = sha1(value).hexdigest()
        self.size = len(value)

    def update_headers(self, response):
        response['ETag'] = self.get_etag()
        # Hashable is the end of the MRO chain - don't call super

    def invalidate_hash(self):
        self.sha1 = None
        self.size = None

    def migrate(self):
        super(Hashable, self).migrate()
        self.update_hash()

    def put(self):
        """
        If we've not calculated a hash for this object, be sure
        to update it before storing in the database.

        Note that subclasses can either call update_hash() when they
        modify an object, or invalidate_hash() to force it to
        be recalculated when stored.
        """
        if self.sha1 is None:
            self.update_hash()
        super(Hashable, self).put()

    @classmethod
    def json_props(cls):
        props = super(Hashable, cls).json_props()
        props.update({'sha1': 'sha1',
                  'size': 'size'})
        return props
