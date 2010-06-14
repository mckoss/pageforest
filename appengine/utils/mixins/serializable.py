from django.utils import simplejson as json

from google.appengine.ext import db

from utils.json import ModelEncoder


class Serializable(db.Model):

    def to_protobuf(self):
        """
        Serialize a datastore entity to a protocol buffer.
        """
        return db.model_to_protobuf(self).Encode()

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
