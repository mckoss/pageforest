import logging

from google.appengine.ext import db


class Migratable(db.Model):
    """
    Model migrations helper class.

    Each class should increment current_schema when schema changes are
    made and implement migrate() to perform the appropriate schema
    migrations to each successive version.

    update_schema() - Call to ensure that the Model is using the
        latest schema version. Note: This is called automatically
        after each get_by_key_name and get_or_insert.

    update_schema_batch() - Migrates a group (default up to 100)
    Models at once.
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
        model = super(Migratable, cls).get_by_key_name(key_name, parent)
        if model is not None:
            model.update_schema()
        return model

    @classmethod
    def get_or_insert(cls, key_name, **kwargs):
        # Look in cache first
        model = super(Migratable, cls).get_or_insert(key_name, **kwargs)
        if model is not None:
            model.update_schema()
        return model

    def update_schema(self):
        if self.schema == self.current_schema:
            return
        schema_old = self.schema
        while self.schema < self.current_schema:
            self.migrate(self.schema + 1)
            self.schema += 1
        self.put()
        logging.info("Updated %s entity %s from schema %d to %d" % (
                self.kind(),
                self.key().id_or_name(),
                schema_old,
                self.schema))

    @classmethod
    def update_schema_batch(cls, limit=100):
        """
        Migrate models in batch.

        TODO: Deferred migration support via callback.
        """
        models = cls.all().filter('schema <', cls.current_schema).fetch(limit)
        for model in models:
            model.update_schema()
        return len(models)

    def migrate(self, next_schema):
        """
        Abstract method, override in subclasses.
        """
        raise NotImplementedError(
            "Application error - missing migration for %s to version %d" %
            type(self).__name__, next_schema)
