import logging

from google.appengine.ext import db


class Migratable(db.Model):
    """
    Model migrations helper class.

    Each class should increment schema_current when schema changes are
    made and implement migrate() to perform the appropriate schema
    migrations to each successive version.

    update_schema() - Call to ensure that the Model is using the
        latest schema version. Note: This is called automatically
        after each get_by_key_name and get_or_insert.

    update_schema_batch() - Migrates a group (default up to 100)
    Models at once.
    """
    schema_current = 1
    schema = db.IntegerProperty(default=1)

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
        schema_old = self.schema
        if schema_old == self.schema_current:
            return

        while db.schema < self.schema_current:
            self.migrate(self.schema + 1)
            self.schema += 1

        self.put()
        logging.info("Updating %s[%s] schema (%d -> %d)" % (
                self.kind(),
                self.key().id_or_name(),
                schema_old,
                self.schema))

    @classmethod
    def update_schema_batch(cls, n=100):
        """
        Migrate models in batch.

        TODO: Deferred migration support via callback.
        """
        models = cls.all().filter('schema <', cls.schema_current).fetch(n)
        for model in models:
            model.update_schema()
        return len(models)

    def migrate(self, schemaNext):
        raise NotImplementedError(
            "Application error - missing migration for %s to version %d" %
            type(self).__name__, schemaNext)
