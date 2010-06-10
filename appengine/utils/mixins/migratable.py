import logging

from google.appengine.ext import db
from google.appengine.api import memcache


class Migratable(db.Model):
    """
    Model migrations helper class.

    Each class should increment current_schema when schema changes are
    made and implement migrate() to perform the appropriate schema
    migrations to each successive version.

    update_schema() - Call to ensure that the entity is using the
        latest schema version. It will call the migrate method once
        and then save the entity to memcache and datastore. Note: This
        is called automatically in get_by_key_name and get_or_insert.

    update_schema_batch() - Migrates a group (default up to 100)
        entities at once and save them back to memcache and datastore.
    """
    current_schema = 1
    schema = db.IntegerProperty()

    def __init__(self, *args, **kwargs):
        super(Migratable, self).__init__(*args, **kwargs)
        if not hasattr(self, 'schema') or not self.schema:
            self.schema = self.current_schema

    @classmethod
    def get_by_key_name(cls, key_name, parent=None):
        """
        Override the Model.get_by_key_name method, to ensure the
        schema version is current after a read.
        """
        entity = super(Migratable, cls).get_by_key_name(key_name, parent)
        if entity is not None:
            entity.update_schema()
        return entity

    @classmethod
    def get_or_insert(cls, key_name, **kwargs):
        """
        Override the Model.get_or_insert method, to ensure the schema
        version is current after a read.
        """
        entity = super(Migratable, cls).get_or_insert(key_name, **kwargs)
        if entity is not None:
            entity.update_schema()
        return entity

    def update_schema(self):
        """
        Migrate entity to current_schema, then write it back to
        memcache and datastore.
        """
        if self.schema == self.current_schema:
            return
        schema_old = self.schema
        self.migrate()
        self.schema = self.current_schema
        self.put()
        logging.info("Updated %s entity %s from schema %d to %d" % (
                self.kind(), self.key().id_or_name(), schema_old, self.schema))

    @classmethod
    def update_schema_batch(cls, limit=100):
        """
        Migrate entities in batch.
        """
        from utils.mixins import Cacheable
        memcache_mapping = {}
        query = cls.all().filter('schema <', cls.current_schema)
        entities = query.fetch(limit)
        for entity in entities:
            entity.migrate()
            entity.schema = entity.current_schema
            if isinstance(entity, Cacheable):
                memcache_mapping[entity.get_cache_key()] = entity.to_protobuf()
        # Write all entities back to memcache and datastore.
        memcache.set_multi(memcache_mapping)
        db.put(entities)
        return len(entities)

    def migrate(self):
        """
        Abstract method, must be overriden in subclasses to update the
        entity from self.schema to self.current_schema.
        """
        raise NotImplementedError(
            "Application error: %s.migrate method is not implemented." %
            self.kind())
