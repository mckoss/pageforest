import re

from django.conf import settings

from google.appengine.ext import db

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
        GET /docs/doc_id/?method=LIST&keysonly=true&tag=0323
    """
    tags = db.StringListProperty()

    def update_tags(self, tags, **kwargs):
        """
        Update tags for this model instance, but don't add or remove
        tags that don't match TAG_REGEX or are reserved for internal
        use.
        """
        # Keep all tags that start with pf: because they are reserved.
        preserved = [tag for tag in self.tags
                     if tag.startswith('pf:')]
        # Filter out new tags that are invalid or reserved.
        accepted = [tag for tag in tags
                    if TAG_REGEX_COMPILED.match(tag)
                    and not tag.startswith('pf:')]
        self.tags = accepted + preserved
