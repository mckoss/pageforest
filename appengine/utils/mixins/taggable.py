import re
import logging

from django.conf import settings
from google.appengine.ext import db
from utils.middleware import RequestMiddleware

TAG_REGEX_COMPILED = re.compile('^%s$' % settings.TAG_REGEX)


class Taggable(db.Model):
    """
    General-purpose tags for storage models like App, Doc, Blob.

    Tags can have an optional "namespace:" prefix (word + colon) to
    allow orthogonal sorting orders or special treatment.

    Apps cannot add or remove tags that start with "pf:" because that
    namespace is reserved for internal use by Pageforest admins. This
    will be useful to add the tag "pf:featured" to showcase the best
    apps on the pageforest.com homepage.

    The tags property on Apps and Docs is readable and writable as
    part of the JSON representation of their metadata.

    The tags property on Blobs can be set with a query string option:
        PUT /docs/doc_id/0323112?tags=0323,03231,032311

    The LIST method allows filtering on a specific tag:
        GET /docs/doc_id/?method=list&keysonly=true&tag=0323
    """
    tags = db.StringListProperty()

    @classmethod
    def json_props(cls):
        props = super(Taggable, cls).json_props()
        props['tags'] = None
        return props

    def update_tags(self, tags, **kwargs):
        """
        Overwrite tags for this model instance, but don't add or remove
        tags that don't match TAG_REGEX or are reserved for internal
        use (unless admin).

        Reserved tags prefixed with '-pf:' will remove reserved tags (if is_admin)
        """
        request = RequestMiddleware.get_request()
        is_admin = request.user and request.user.is_admin
        # Keep all tags that start with pf: because they are reserved.
        preserved = [tag for tag in self.tags if tag.startswith('pf:')]
        if is_admin:
            remove = [tag[1:] for tag in tags if tag.startswith('-pf:')]
            preserved = [tag for tag in preserved if tag not in remove]

        # Filter out new tags that are invalid or reserved.
        accepted = [tag for tag in tags
                    if TAG_REGEX_COMPILED.match(tag)
                    and (is_admin or not tag.startswith('pf:'))]
        # Limit the number of tags per entity.
        if len(accepted + preserved) > settings.MAX_TAGS_PER_ENTITY:
            accepted = accepted[:settings.MAX_TAGS_PER_ENTITY - len(preserved)]
        self.tags = list(set(accepted + preserved))

    def add_reserved(self, tag):
        self.tags = list(set(self.tags + ['pf:' + tag]))

    def remove_reserved(self, tag):
        if 'pf:' + tag in self.tags:
            self.tags.remove('pf:' + tag)
