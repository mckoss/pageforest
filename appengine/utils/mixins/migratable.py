import logging

from google.appengine.ext import db
from google.appengine.api import memcache
from google.appengine.runtime import apiproxy_errors


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
        result = super(Migratable, cls).get_by_key_name(key_name, parent)
        if isinstance(key_name, basestring):
            if result is not None:
                result.update_schema()
        elif isinstance(key_name, list):
            cls.update_schema_list(result, write_to_memcache=True)
        return result

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
        # Don't migrate downward - note that migrate() may not
        # even be defined yet!
        if self.schema >= self.current_schema:
            return
        schema_old = self.schema
        self.migrate()
        self.schema = self.current_schema
        description = "%s entity %s from schema %d to %d" % (
            self.kind(), self.key().id_or_name(), schema_old, self.schema)
        try:
            self.put()
        except apiproxy_errors.Error:
            logging.warning(
                "Datastore put failed when trying to update " + description)
        else:
            logging.info("Updated " + description)

    @classmethod
    def update_schema_batch(cls, limit=100, write_to_memcache=False):
        """
        Migrate entities in batch.
        """
        query = cls.all().filter('schema <', cls.current_schema)
        entities = query.fetch(limit)
        cls.update_schema_list(entities, write_to_memcache)
        return len(entities)

    @classmethod
    def update_schema_list(cls, entities, write_to_memcache=False):
        """
        Update the schema for a list of entities. This method is
        called by get_by_key_name_list and update_schema_batch.
        """
        put_entities = []
        memcache_mapping = {}
        for entity in entities:
            if entity is None or entity.schema == cls.current_schema:
                continue
            entity.migrate()
            entity.schema = entity.current_schema
            put_entities.append(entity)
            if write_to_memcache:
                memcache_mapping[entity.get_cache_key()] = entity.to_protobuf()
        if memcache_mapping:
            memcache.set_multi(memcache_mapping)
        if put_entities:
            db.put(put_entities)

    def migrate(self):
        """
        Abstract method, must be overriden in subclasses to update the
        entity from self.schema to self.current_schema.
        """
        raise NotImplementedError(
            "Application error: %s.migrate method is not implemented." %
            self.kind())
