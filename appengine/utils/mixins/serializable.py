from django.utils import simplejson as json

from google.appengine.ext import db

from utils.json import ModelEncoder


ALWAYS_EXCLUDE = ['created_ip', 'modified_ip', 'secret', 'schema']


class Serializable(db.Model):

    def to_json(self, extra=None, include=None, exclude=None, indent=2):
        """
        Serialize a datastore entity to JSON.
        """
        result = {}
        for name in self.properties():
            if name in ALWAYS_EXCLUDE:
                continue
            if exclude and name in exclude:
                continue
            if include and name not in include:
                continue
            result[name] = getattr(self, name)
        if extra:
            result.update(extra)
        if indent is None:
            separators = (', ', ': ')
        else:
            separators = (',', ': ')
        return json.dumps(result, sort_keys=True, indent=indent,
                          separators=separators, cls=ModelEncoder)
